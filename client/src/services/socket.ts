import { io, Socket } from 'socket.io-client';
import Taro from '@tarojs/taro';
import { WS_URL } from '../env';

let socket: Socket | null = null;
let isConnected = false;
let lastUserId: string | null = null;
let lastUserRole: string | null = null;

export interface OrderUpdatedEvent {
  order: Record<string, any>;
  previousStatus: string;
}

export interface OrderCreatedEvent {
  order: Record<string, any>;
}

export type OrderUpdatedCallback = (data: OrderUpdatedEvent) => void;
export type OrderCreatedCallback = (data: OrderCreatedEvent) => void;

// 存储每个页面的监听器回调
const orderUpdatedCallbacks: Map<string, OrderUpdatedCallback> = new Map();
const orderCreatedCallbacks: Map<string, OrderCreatedCallback> = new Map();

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
    localStorage.setItem('debug', '');
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
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10000,
    forceNew: true,
  });

  socket.on('connect', () => {
    isConnected = true;
    if (lastUserId && lastUserRole) {
      joinUserRoom(lastUserId, lastUserRole);
    }
  });

  socket.on('disconnect', () => {
    isConnected = false;
  });

  socket.on('connect_error', (error: any) => {
    console.warn('[Socket] 连接错误:', error.message || error);
    isConnected = false;
  });

  socket.on('reconnect', (attempt) => {
    isConnected = true;
    if (lastUserId && lastUserRole) {
      joinUserRoom(lastUserId, lastUserRole);
    }
  });
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    isConnected = false;
  }
}

export function joinUserRoom(userId: string, role: string): void {
  if (!socket || !isConnected) return;
  socket.emit('order:joined', { userId, role });
}

export function onOrderUpdated(callback: OrderUpdatedCallback, pageId?: string): void {
  if (!socket) return;
  
  // 如果提供了 pageId，存储回调以便后续移除
  if (pageId) {
    orderUpdatedCallbacks.set(pageId, callback);
  }
  
  // 移除旧的监听器并重新注册
  socket.off('order:updated');
  socket.on('order:updated', (data: OrderUpdatedEvent) => {
    try {
      // 调用所有注册的回调
      orderUpdatedCallbacks.forEach((cb) => cb(data));
    } catch (e) {
      console.error('[Socket] 回调错误:', e);
    }
  });
}

export function onOrderCreated(callback: OrderCreatedCallback, pageId?: string): void {
  if (!socket) return;
  
  // 如果提供了 pageId，存储回调以便后续移除
  if (pageId) {
    orderCreatedCallbacks.set(pageId, callback);
  }
  
  // 移除旧的监听器并重新注册
  socket.off('order:created');
  socket.on('order:created', (data: OrderCreatedEvent) => {
    try {
      // 调用所有注册的回调
      orderCreatedCallbacks.forEach((cb) => cb(data));
    } catch (e) {
      console.error('[Socket] 回调错误:', e);
    }
  });
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
    socket.off('order:updated');
  }
}
