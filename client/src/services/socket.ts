import { io, Socket } from 'socket.io-client';
import Taro from '@tarojs/taro';
import { WS_URL } from '../env';

// 微信小程序全局对象类型声明（避免 TS 报错，运行时由微信小程序环境注入）
declare const wx: unknown;

let socket: Socket | null = null;
let isConnected = false;
let lastUserId: string | null = null;
let lastUserRole: string | null = null;

export interface OrderUpdatedEvent {
  order: Record<string, unknown>;
  previousStatus: string;
}

export interface OrderCreatedEvent {
  order: Record<string, unknown>;
}

export type OrderUpdatedCallback = (data: OrderUpdatedEvent) => void;
export type OrderCreatedCallback = (data: OrderCreatedEvent) => void;

// 存储每个页面的监听器回调
const orderUpdatedCallbacks: Map<string, OrderUpdatedCallback> = new Map();
const orderCreatedCallbacks: Map<string, OrderCreatedCallback> = new Map();
let isOrderUpdatedHandlerBound = false;
let isOrderCreatedHandlerBound = false;

/** 检测是否在微信小程序环境 */
const isMiniProgram = typeof wx !== 'undefined';

export function getSocket(): Socket | null {
  return socket;
}

export function isSocketConnected(): boolean {
  return isConnected;
}

export function connectSocket(token: string, userId?: string, role?: string): void {
  if (socket) {
    disconnectSocket();
  }

  lastUserId = userId || null;
  lastUserRole = role || null;

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

  socket.on('connect', () => {
    isConnected = true;
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
  });

  socket.on('connect_error', (error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[Socket] 连接错误:', msg);
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
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    isConnected = false;
    isOrderUpdatedHandlerBound = false;
    isOrderCreatedHandlerBound = false;
    // 清除缓存的用户身份，避免下次连接复用旧身份（导致加入错误房间）
    lastUserId = null;
    lastUserRole = null;
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

export function removePageListeners(pageId: string): void {
  orderUpdatedCallbacks.delete(pageId);
  orderCreatedCallbacks.delete(pageId);
}

export function removeAllListeners(): void {
  orderUpdatedCallbacks.clear();
  orderCreatedCallbacks.clear();
  if (socket) {
    socket.off('order:updated');
    socket.off('order:created');
  }
  isOrderUpdatedHandlerBound = false;
  isOrderCreatedHandlerBound = false;
}
