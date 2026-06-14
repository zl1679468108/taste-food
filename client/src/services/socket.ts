import { io, Socket } from 'socket.io-client';
import Taro from '@tarojs/taro';
import { WS_URL } from '../env';
import { Order } from '../types/order';

let socket: Socket | null = null;
let isConnected = false;

/** 订单更新事件数据 */
export interface OrderUpdatedEvent {
  order: Order;
  previousStatus: string;
}

/** 新订单事件数据 */
export interface OrderCreatedEvent {
  order: Order;
}

/** 订单更新回调 */
export type OrderUpdatedCallback = (data: OrderUpdatedEvent) => void;

/** 新订单回调 */
export type OrderCreatedCallback = (data: OrderCreatedEvent) => void;

/**
 * 获取当前 socket 实例
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * 是否已连接
 */
export function isSocketConnected(): boolean {
  return isConnected;
}

/**
 * 连接 WebSocket 服务
 * @param token JWT token
 */
export function connectSocket(token: string): void {
  // 如果已经有连接则先断开
  if (socket) {
    disconnectSocket();
  }

  const url = `${WS_URL}/orders`;

  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 3000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    isConnected = true;
    console.log('[Socket] 已连接:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    isConnected = false;
    console.log('[Socket] 断开连接:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] 连接错误:', error.message);
    isConnected = false;
  });

  socket.on('reconnect', (attempt) => {
    isConnected = true;
    console.log('[Socket] 重连成功, 尝试次数:', attempt);
  });
}

/**
 * 断开 WebSocket 连接
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    isConnected = false;
    console.log('[Socket] 已手动断开');
  }
}

/**
 * 加入用户/管理员房间
 * @param userId 用户 ID
 * @param role 角色 ('admin' | 'customer')
 */
export function joinUserRoom(userId: string, role: string): void {
  if (!socket || !isConnected) {
    console.warn('[Socket] 未连接，无法加入房间');
    return;
  }

  socket.emit('order:joined', { userId, role });
  console.log(`[Socket] 已加入房间: userId=${userId}, role=${role}`);
}

/**
 * 监听订单更新事件
 */
export function onOrderUpdated(callback: OrderUpdatedCallback): void {
  if (!socket) return;
  socket.off('order:updated');
  socket.on('order:updated', (data: OrderUpdatedEvent) => {
    console.log('[Socket] 订单更新:', data.order.id, data.previousStatus, '->', data.order.status);
    callback(data);
  });
}

/**
 * 监听新订单事件（管理员用）
 */
export function onOrderCreated(callback: OrderCreatedCallback): void {
  if (!socket) return;
  socket.off('order:created');
  socket.on('order:created', (data: OrderCreatedEvent) => {
    console.log('[Socket] 新订单:', data.order.id, '金额:', data.order.total);
    callback(data);
  });
}

/**
 * 移除所有监听器
 */
export function removeAllListeners(): void {
  if (socket) {
    socket.off('order:updated');
    socket.off('order:created');
  }
}
