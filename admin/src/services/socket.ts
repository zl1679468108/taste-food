/**
 * 管理后台 WebSocket 接入（socket.io）
 *
 * - namespace: `/orders`，鉴权通过 `handshake.auth.token` 传 access token
 *   （与 client/src/services/socket.ts 一致，禁止走 URL query 避免 token 泄漏到日志/反代）
 * - 服务端 handleConnection 会按 token 中的 shopId 自动加入 `shop:${shopId}` 房间，
 *   前端无需手动 join
 * - 连接采用引用计数：多个面板/组件同时订阅只保留一条连接，最后一个卸载时才真正断开
 * - 心跳监控：检测服务端 ping 超时并主动重连，防止长连接假死
 */
import { io, Socket } from 'socket.io-client';
import type { InboxNotification } from '@/services/notification';

/** 骑手位置实时推送（服务端 order.gateway 的 delivery:track） */
export interface DeliveryTrackEvent {
  orderId: string;
  shopId: string;
  userId: string;
  riderId?: string;
  /** 骑手当前同时配送的订单数 */
  riderDeliveryCount?: number;
  latitude: number;
  longitude: number;
  recordedAt: string;
}

/** 商家新待处理订单（服务端 order.gateway 的 order:new / order:paid） */
export interface OrderNewEvent {
  orderId?: string;
  shopId?: string;
  total?: number;
  deliveryType?: string;
  status?: string;
  itemCount?: number;
  contactName?: string;
  contactPhone?: string;
  tableNo?: string;
  address?: string;
  previousStatus?: string;
  event?: string;
  order: Record<string, unknown>;
}

/**
 * 站内通知推送（服务端 order.gateway 的 notification:new）。
 * 服务端会附带权威 unreadCount，前端优先采信它而不是本地 +1，
 * 避免多标签页/多设备场景下角标漂移；老版本服务端不带该字段时回退本地累加。
 */
export type NotificationNewEvent = InboxNotification & { unreadCount?: number };

export type DeliveryTrackCallback = (data: DeliveryTrackEvent) => void;
export type NotificationCallback = (data: NotificationNewEvent) => void;
export type OrderNewCallback = (data: OrderNewEvent) => void;
/** WS （重）连成功回调：用于断线重连后重新拉取数据做对齐 */
export type ReconnectCallback = () => void;

const ORDERS_NAMESPACE = '/orders';
const DELIVERY_TRACK_EVENT = 'delivery:track';
const NOTIFICATION_NEW_EVENT = 'notification:new';
const ORDER_NEW_EVENT = 'order:new';

let current: Socket | null = null;
let connected = false;
/** 引用计数：connectSocket 累加，disconnectSocket 递减，归零才断开 */
let refCount = 0;
let bound = false;
/** 区分「首次连接」与「断线重连」，只有后者需要触发数据对齐 */
let hasConnectedOnce = false;
let lastToken: string | null = null;

// 心跳监控
let lastPingAt = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_TIMEOUT_MS = 45_000; // 服务端 pingInterval 25s + pingTimeout 10s + 缓冲

const deliveryTrackCbs = new Set<DeliveryTrackCallback>();
const notificationCbs = new Set<NotificationCallback>();
const orderNewCbs = new Set<OrderNewCallback>();
const reconnectCbs = new Set<ReconnectCallback>();

function readToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function startHeartbeatMonitor(): void {
  if (heartbeatTimer) return;
  lastPingAt = Date.now();
  heartbeatTimer = setInterval(() => {
    if (!current || !connected) {
      stopHeartbeatMonitor();
      return;
    }
    if (Date.now() - lastPingAt > HEARTBEAT_TIMEOUT_MS) {
      console.warn('[Socket] 心跳超时，主动重连');
      current.disconnect();
    }
  }, 10_000);
}

function stopHeartbeatMonitor(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * WS 基础地址。
 * 开发态 UMI devServer 仅代理 `/api`（见 config/proxy.ts），socket.io 需直连后端；
 * 生产态与页面同源，由 nginx 转发 `/socket.io`。
 */
function resolveBase(): string {
  if (process.env.NODE_ENV !== 'production') return 'http://127.0.0.1:3010';
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function emitDeliveryTrack(data: DeliveryTrackEvent): void {
  deliveryTrackCbs.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.error('[Socket] delivery:track 回调执行失败:', e);
    }
  });
}

function emitReconnected(): void {
  reconnectCbs.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('[Socket] reconnect 回调执行失败:', e);
    }
  });
}

function emitNotification(data: NotificationNewEvent): void {
  notificationCbs.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.error('[Socket] notification:new 回调执行失败:', e);
    }
  });
}

function emitOrderNew(data: OrderNewEvent): void {
  orderNewCbs.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.error('[Socket] order:new/paid 回调执行失败:', e);
    }
  });
}

function bind(target: Socket): void {
  if (bound) return;
  bound = true;
  target.on(DELIVERY_TRACK_EVENT, emitDeliveryTrack);
  target.on(NOTIFICATION_NEW_EVENT, emitNotification);
  target.on(ORDER_NEW_EVENT, emitOrderNew);
}

export function isSocketConnected(): boolean {
  return connected;
}

/**
 * 建立（或复用）与 `/orders` 命名空间的连接。
 * 重复调用只累加引用计数，不会创建第二条连接；无 token 时返回 null。
 */
export function connectSocket(): Socket | null {
  const token = readToken();
  if (!token) return null;

  lastToken = token;
  refCount += 1;
  if (current) {
    bind(current);
    return current;
  }

  try {
    current = io(`${resolveBase()}${ORDERS_NAMESPACE}`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      timeout: 10000,
    });
  } catch (e) {
    console.error('[Socket] 初始化失败:', e);
    current = null;
    refCount = Math.max(0, refCount - 1);
    return null;
  }

  // 重连时自动更新 auth token
  current.io.on('reconnect_attempt', () => {
    if (current) current.auth = { token: readToken() };
  });

  current.on('connect', () => {
    const isReconnect = hasConnectedOnce;
    connected = true;
    hasConnectedOnce = true;
    startHeartbeatMonitor();
    // 断线期间服务端推送的事件已经丢了，通知订阅方重新拉一次数据做对齐。
    // 首次连接不触发：此时组件自己的初始化请求已经在跑，重复拉取没有意义。
    if (isReconnect) emitReconnected();
  });

  current.on('disconnect', () => {
    connected = false;
    stopHeartbeatMonitor();
  });

  // 监听服务端 ping
  current.on('ping', () => {
    lastPingAt = Date.now();
  });

  current.on('connect_error', (error: unknown) => {
    connected = false;
    console.error('[Socket] 连接错误:', error instanceof Error ? error.message : error);
  });

  bind(current);
  return current;
}

/** 释放一次连接引用；引用归零时断开连接并清理所有监听 */
export function disconnectSocket(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !current) return;
  try {
    current.off(DELIVERY_TRACK_EVENT, emitDeliveryTrack);
    current.off(NOTIFICATION_NEW_EVENT, emitNotification);
    current.off(ORDER_NEW_EVENT, emitOrderNew);
    current.removeAllListeners();
    current.io.off('reconnect_attempt');
    current.disconnect();
  } catch (e) {
    console.error('[Socket] 断开连接失败:', e);
  } finally {
    current = null;
    connected = false;
    bound = false;
    hasConnectedOnce = false;
    lastToken = null;
    stopHeartbeatMonitor();
    deliveryTrackCbs.clear();
    notificationCbs.clear();
    orderNewCbs.clear();
    reconnectCbs.clear();
  }
}

/** 订阅骑手位置推送（同一回调重复注册只生效一次） */
export function onDeliveryTrackUpdated(cb: DeliveryTrackCallback): void {
  deliveryTrackCbs.add(cb);
  if (current) bind(current);
}

/** 取消订阅骑手位置推送 */
export function offDeliveryTrackUpdated(cb: DeliveryTrackCallback): void {
  deliveryTrackCbs.delete(cb);
}

/** 订阅站内通知推送 */
export function onNotificationNew(cb: NotificationCallback): void {
  notificationCbs.add(cb);
  if (current) bind(current);
}

/** 取消订阅站内通知推送 */
export function offNotificationNew(cb: NotificationCallback): void {
  notificationCbs.delete(cb);
}

/**
 * 订阅「断线重连成功」事件。
 * 重连期间的推送已丢失，订阅方应在回调里重新拉取一次数据做对齐。
 */
export function onSocketReconnect(cb: ReconnectCallback): void {
  reconnectCbs.add(cb);
}

/** 取消订阅断线重连事件 */
export function offSocketReconnect(cb: ReconnectCallback): void {
  reconnectCbs.delete(cb);
}

/** 订阅商家新待处理订单推送（order:new / order:paid） */
export function onOrderNew(cb: OrderNewCallback): void {
  orderNewCbs.add(cb);
  if (current) bind(current);
}

/** 取消订阅商家新待处理订单推送 */
export function offOrderNew(cb: OrderNewCallback): void {
  orderNewCbs.delete(cb);
}

export function getSocket(): Socket | null {
  return current;
}
