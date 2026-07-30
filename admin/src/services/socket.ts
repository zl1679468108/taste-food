/**
 * 管理后台 WebSocket 接入（socket.io）
 *
 * - namespace: `/orders`，鉴权通过 `handshake.auth.token` 传 access token
 *   （与 client/src/services/socket.ts 一致，禁止走 URL query 避免 token 泄漏到日志/反代）
 * - 服务端 handleConnection 会按 token 中的 shopId 自动加入 `shop:${shopId}` 房间，
 *   前端无需手动 join
 * - 连接采用引用计数：多个面板/组件同时订阅只保留一条连接，最后一个卸载时才真正断开
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

export type DeliveryTrackCallback = (data: DeliveryTrackEvent) => void;
export type NotificationCallback = (data: InboxNotification) => void;

const ORDERS_NAMESPACE = '/orders';
const DELIVERY_TRACK_EVENT = 'delivery:track';
const NOTIFICATION_NEW_EVENT = 'notification:new';

let current: Socket | null = null;
let connected = false;
/** 引用计数：connectSocket 累加，disconnectSocket 递减，归零才断开 */
let refCount = 0;
let bound = false;

const deliveryTrackCbs = new Set<DeliveryTrackCallback>();
const notificationCbs = new Set<NotificationCallback>();

function readToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
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

function emitNotification(data: InboxNotification): void {
  notificationCbs.forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.error('[Socket] notification:new 回调执行失败:', e);
    }
  });
}

function bind(target: Socket): void {
  if (bound) return;
  bound = true;
  target.on(DELIVERY_TRACK_EVENT, emitDeliveryTrack);
  target.on(NOTIFICATION_NEW_EVENT, emitNotification);
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

  current.on('connect', () => {
    connected = true;
  });

  current.on('disconnect', () => {
    connected = false;
  });

  current.on('connect_error', (error: unknown) => {
    connected = false;
    console.error('[Socket] 连接错误:', error instanceof Error ? error.message : error);
  });

  // 重连时带上最新 token（access token 可能已被 refresh 轮换）
  current.io.on('reconnect_attempt', () => {
    if (current) current.auth = { token: readToken() };
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
    current.removeAllListeners();
    current.io.off('reconnect_attempt');
    current.disconnect();
  } catch (e) {
    console.error('[Socket] 断开连接失败:', e);
  } finally {
    current = null;
    connected = false;
    bound = false;
    deliveryTrackCbs.clear();
    notificationCbs.clear();
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

export function getSocket(): Socket | null {
  return current;
}
