import { io, Socket } from 'socket.io-client';
import Taro from '@tarojs/taro';
import { WS_URL } from '../env';
import newOrderAlertSrc from '../assets/sounds/new-order.wav';
import { logger } from '../utils/logger';

// 微信小程序全局对象类型声明（避免 TS 报错，运行时由微信小程序环境注入）
declare const wx: unknown;

let socket: Socket | null = null;
let isConnected = false;
let lastUserId: string | null = null;
let lastUserRole: string | null = null;
let lastToken: string | null = null;

// 心跳监控：记录最后收到 ping 的时间，超时则主动重连
let lastPingAt = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_TIMEOUT_MS = 45_000; // 服务端 pingInterval 25s + pingTimeout 10s + 缓冲

export interface OrderEventSummary {
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

export interface OrderUpdatedEvent extends OrderEventSummary {
  previousStatus: string;
}

export interface OrderCreatedEvent extends OrderEventSummary {}

/** 商家新待处理订单（支付成功） */
export type OrderNewEvent = OrderEventSummary;
export type OrderPaidEvent = OrderEventSummary;

export interface DeliveryTrackEvent {
  orderId: string;
  shopId: string;
  userId: string;
  riderId?: string;
  riderDeliveryCount?: number;
  latitude: number;
  longitude: number;
  recordedAt: string;
}

export type OrderUpdatedCallback = (data: OrderUpdatedEvent) => void;
export type OrderCreatedCallback = (data: OrderCreatedEvent) => void;
export type OrderNewCallback = (data: OrderNewEvent) => void;
export type DeliveryTrackCallback = (data: DeliveryTrackEvent) => void;

// 存储每个页面的监听器回调
const orderUpdatedCallbacks: Map<string, OrderUpdatedCallback> = new Map();
const orderCreatedCallbacks: Map<string, OrderCreatedCallback> = new Map();
const orderNewCallbacks: Map<string, OrderNewCallback> = new Map();
const deliveryTrackCallbacks: Map<string, DeliveryTrackCallback> = new Map();
let isOrderUpdatedHandlerBound = false;
let isOrderCreatedHandlerBound = false;
let isOrderNewHandlerBound = false;
let isDeliveryTrackHandlerBound = false;

/** 检测是否在微信小程序环境 */
const isMiniProgram = typeof wx !== 'undefined';

export function getSocket(): Socket | null {
  return socket;
}

export function isSocketConnected(): boolean {
  return isConnected;
}

function startHeartbeatMonitor(): void {
  if (heartbeatTimer) return;
  lastPingAt = Date.now();
  heartbeatTimer = setInterval(() => {
    if (!socket || !isConnected) {
      stopHeartbeatMonitor();
      return;
    }
    // 如果超过阈值未收到服务端 ping，认为连接失效，触发重连
    if (Date.now() - lastPingAt > HEARTBEAT_TIMEOUT_MS) {
      logger.warn('[Socket] 心跳超时，主动重连');
      socket.disconnect(); // 触发自动重连逻辑
    }
  }, 10_000);
}

function stopHeartbeatMonitor(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function connectSocket(token: string, userId?: string, role?: string): void {
  if (socket) {
    disconnectSocket();
  }

  lastUserId = userId || null;
  lastUserRole = role || null;
  lastToken = token;

  // 禁用 socket.io 内部的 debug 日志（避免 console.log 复杂对象导致调试器克隆失败）
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__DEBUG__ = 0;
  }
  try {
    Taro.setStorageSync('debug', '');
  } catch {
    // storage 不可用时忽略
  }

  let baseUrl = WS_URL;
  if (baseUrl.includes('localhost')) {
    baseUrl = baseUrl.replace('localhost', '127.0.0.1');
  }

  const url = `${baseUrl}/orders`;

  // 小程序环境优先使用 WebSocket 传输，避免 polling 握手失败
  const transports = isMiniProgram ? ['websocket'] : ['websocket', 'polling'];

  socket = io(url, {
    auth: { token },
    transports,
    // 禁用 transport upgrade：避免小程序环境从 polling 升级到 websocket 失败
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: Infinity, // 无限重连，避免网络波动后永久断开
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000, // 最大退避 30 秒
    timeout: 10000,
    forceNew: true,
  });

  // 重连时自动更新 auth token（access token 可能已被 refresh 轮换）
  socket.io.on('reconnect_attempt', () => {
    if (socket && lastToken) {
      socket.auth = { token: lastToken };
    }
  });

  socket.on('connect', () => {
    isConnected = true;
    startHeartbeatMonitor();
    // 连接/重连后绑定事件 handler，确保回调可用
    bindOrderHandlers();
    // 重放 joinUserRoom：连接建立后重新声明身份（服务端 handleConnection 已根据 JWT
    // 自动加入对应房间，此处仅作为向后兼容确认）
    if (lastUserId && lastUserRole) {
      joinUserRoom(lastUserId, lastUserRole);
    }
  });

  socket.on('disconnect', () => {
    isConnected = false;
    stopHeartbeatMonitor();
  });

  // 监听服务端 ping，更新心跳时间戳
  socket.on('ping', () => {
    lastPingAt = Date.now();
  });

  socket.on('connect_error', (error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn('[Socket] 连接错误:', msg);
    isConnected = false;
  });
}

/**
 * 绑定 order:updated / order:created 事件 handler。
 * 在 connect/reconnect 时调用，确保已注册的回调能收到推送。
 */
function bindOrderHandlers(): void {
  if (!socket) return;
  if (!isOrderUpdatedHandlerBound && orderUpdatedCallbacks.size > 0) {
    isOrderUpdatedHandlerBound = true;
    socket.on('order:updated', (data: OrderUpdatedEvent) => {
      orderUpdatedCallbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('[Socket] order:updated 回调错误:', e);
        }
      });
    });
  }
  if (!isOrderCreatedHandlerBound && orderCreatedCallbacks.size > 0) {
    isOrderCreatedHandlerBound = true;
    socket.on('order:created', (data: OrderCreatedEvent) => {
      orderCreatedCallbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('[Socket] order:created 回调错误:', e);
        }
      });
    });
  }
  if (!isOrderNewHandlerBound && orderNewCallbacks.size > 0) {
    isOrderNewHandlerBound = true;
    const dispatchNew = (data: OrderNewEvent) => {
      orderNewCallbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('[Socket] order:new 回调错误:', e);
        }
      });
    };
    socket.on('order:new', dispatchNew);
    socket.on('order:paid', dispatchNew);
  }
  if (!isDeliveryTrackHandlerBound && deliveryTrackCallbacks.size > 0) {
    isDeliveryTrackHandlerBound = true;
    socket.on('delivery:track', (data: DeliveryTrackEvent) => {
      deliveryTrackCallbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('[Socket] delivery:track 回调错误:', e);
        }
      });
    });
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    isConnected = false;
    isOrderUpdatedHandlerBound = false;
    isOrderCreatedHandlerBound = false;
    isOrderNewHandlerBound = false;
    isDeliveryTrackHandlerBound = false;
    // 清除缓存的用户身份，避免下次连接复用旧身份（导致加入错误房间）
    lastUserId = null;
    lastUserRole = null;
    lastToken = null;
    stopHeartbeatMonitor();
  }
}

export function joinUserRoom(userId: string, role: string): void {
  if (!socket || !isConnected) {
    // socket 未连接时缓存身份，connect 事件触发后会自动重放
    lastUserId = userId;
    lastUserRole = role;
    return;
  }
  // 缓存身份用于重连后重放
  lastUserId = userId;
  lastUserRole = role;
  socket.emit('order:joined', { userId, role });
}

export function onOrderUpdated(callback: OrderUpdatedCallback, pageId?: string): void {
  // 先注册回调到 Map，即使 socket 为 null 也不丢失（连接后由 bindOrderHandlers 绑定）
  const key = pageId || `anonymous-${Date.now()}-${orderUpdatedCallbacks.size}`;
  orderUpdatedCallbacks.set(key, callback);

  // 如果 socket 已存在且 handler 未绑定，立即绑定
  if (socket && !isOrderUpdatedHandlerBound) {
    bindOrderHandlers();
  }
}

export function onOrderCreated(callback: OrderCreatedCallback, pageId?: string): void {
  // 先注册回调到 Map，即使 socket 为 null 也不丢失
  const key = pageId || `anonymous-${Date.now()}-${orderCreatedCallbacks.size}`;
  orderCreatedCallbacks.set(key, callback);

  // 如果 socket 已存在且 handler 未绑定，立即绑定
  if (socket && !isOrderCreatedHandlerBound) {
    bindOrderHandlers();
  }
}

export function onDeliveryTrackUpdated(callback: DeliveryTrackCallback, pageId?: string): void {
  const key = pageId || `anonymous-${Date.now()}-${deliveryTrackCallbacks.size}`;
  deliveryTrackCallbacks.set(key, callback);

  if (socket && !isDeliveryTrackHandlerBound) {
    bindOrderHandlers();
  }
}

/** 监听商家新待处理订单（order:new / order:paid） */
export function onOrderNew(callback: OrderNewCallback, pageId?: string): void {
  const key = pageId || `anonymous-${Date.now()}-${orderNewCallbacks.size}`;
  orderNewCallbacks.set(key, callback);
  if (socket && !isOrderNewHandlerBound) {
    bindOrderHandlers();
  }
}

export function removePageListeners(pageId: string): void {
  orderUpdatedCallbacks.delete(pageId);
  orderCreatedCallbacks.delete(pageId);
  orderNewCallbacks.delete(pageId);
  deliveryTrackCallbacks.delete(pageId);
}

export function removeAllListeners(): void {
  orderUpdatedCallbacks.clear();
  orderCreatedCallbacks.clear();
  orderNewCallbacks.clear();
  deliveryTrackCallbacks.clear();
  if (socket) {
    socket.off('order:updated');
    socket.off('order:created');
    socket.off('order:new');
    socket.off('order:paid');
    socket.off('delivery:track');
  }
  isOrderUpdatedHandlerBound = false;
  isOrderCreatedHandlerBound = false;
  isOrderNewHandlerBound = false;
  isDeliveryTrackHandlerBound = false;
}

/**
 * 商家新订单本地提醒：短振动 + 可选提示音（失败静默忽略）。
 * 商家页不在 tabBar 内时不设角标，由调用方决定。
 * 默认使用 assets/sounds/new-order.wav；无资源时仅振动。
 */
const NEW_ORDER_ALERT_SRC = newOrderAlertSrc;

export function playMerchantNewOrderAlert(): void {
  try {
    Taro.vibrateShort({ type: 'heavy' });
  } catch {
    try {
      Taro.vibrateLong();
    } catch {
      // 模拟器/无振动设备忽略
    }
  }

  if (!NEW_ORDER_ALERT_SRC) {
    return;
  }

  try {
    const audio = Taro.createInnerAudioContext();
    audio.autoplay = true;
    audio.src = NEW_ORDER_ALERT_SRC;
    const cleanup = () => {
      try {
        audio.destroy();
      } catch {
        // ignore
      }
    };
    audio.onError(cleanup);
    audio.onEnded(cleanup);
    try {
      audio.play();
    } catch {
      cleanup();
    }
  } catch {
    // InnerAudioContext 不可用时忽略
  }
}
