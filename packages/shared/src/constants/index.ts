/**
 * 全局共享常量
 * 与 server 端 common/constants/enums.ts 保持一致
 */

/** 订单状态枚举 */
export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  ACCEPTED = 'accepted',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  DELIVERING = 'delivering',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

/** 配送方式枚举 */
export enum DeliveryType {
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
  DINE_IN = 'dine_in',
}

/** 菜品状态枚举 */
export enum MenuItemStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/** 店铺状态枚举 */
export enum ShopStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

/** 用户角色枚举 */
export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  RIDER = 'rider',
}

/** 促销类型枚举 */
export enum PromotionType {
  FULL_DISCOUNT = 'full_discount',
  FIRST_ORDER = 'first_order',
  COUPON = 'coupon',
  DISCOUNT = 'discount',
}

/** 促销状态枚举 */
export enum PromotionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
}

/**
 * 默认店铺 ID（单店铺场景兜底，多店铺场景由 admin 绑定的 shopId 覆盖）
 * 与 server 端 common/constants/shop.ts、database-init.sql 种子数据保持一致
 */
export const DEFAULT_SHOP_ID = '00000000-0000-0000-0000-000000000001';

/** 订单状态中文映射 */
export const ORDER_STATUS_MAP: Record<string, string> = {
  [OrderStatus.PENDING_PAYMENT]: '待支付',
  [OrderStatus.PAID]: '已支付',
  [OrderStatus.ACCEPTED]: '已接单',
  [OrderStatus.PREPARING]: '制作中',
  [OrderStatus.READY_FOR_PICKUP]: '待自取',
  [OrderStatus.DELIVERING]: '配送中',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.CANCELLED]: '已取消',
  [OrderStatus.REJECTED]: '已拒绝',
};

/** 配送方式中文映射（三端统一文案） */
export const DELIVERY_TYPE_MAP: Record<string, string> = {
  [DeliveryType.DELIVERY]: '外卖配送',
  [DeliveryType.PICKUP]: '到店自取',
  [DeliveryType.DINE_IN]: '堂食',
};

/** 订单状态颜色映射（用于 UI 标签着色） */
export const ORDER_STATUS_COLOR_MAP: Record<string, string> = {
  [OrderStatus.PENDING_PAYMENT]: '#f59e0b', // 黄色
  [OrderStatus.PAID]: '#3b82f6',             // 蓝色
  [OrderStatus.ACCEPTED]: '#8b5cf6',          // 紫色
  [OrderStatus.PREPARING]: '#f97316',         // 橙色
  [OrderStatus.READY_FOR_PICKUP]: '#d946ef',  // 品红
  [OrderStatus.DELIVERING]: '#06b6d4',        // 青色
  [OrderStatus.COMPLETED]: '#22c55e',         // 绿色
  [OrderStatus.CANCELLED]: '#6b7280',         // 灰色
  [OrderStatus.REJECTED]: '#ef4444',          // 红色
};

/** 促销类型中文映射 */
export const PROMOTION_TYPE_MAP: Record<string, string> = {
  [PromotionType.FULL_DISCOUNT]: '满减',
  [PromotionType.FIRST_ORDER]: '首单立减',
  [PromotionType.COUPON]: '优惠券',
  [PromotionType.DISCOUNT]: '折扣',
};

/** 用户角色中文映射 */
export const USER_ROLE_MAP: Record<string, string> = {
  [UserRole.CUSTOMER]: '顾客',
  [UserRole.ADMIN]: '商家',
  [UserRole.RIDER]: '骑手',
};

/**
 * 订单状态流转规则（与 server 端 order.service.ts validateStatusTransition 保持一致）
 * key: 当前状态，value: 可流转到的下一状态列表
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.DELIVERING, OrderStatus.READY_FOR_PICKUP],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.COMPLETED],
  [OrderStatus.DELIVERING]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REJECTED]: [],
};

/**
 * 判断订单状态是否可以流转到目标状态
 */
export function canTransitionTo(from: string, to: string): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * 判断订单状态是否为终态（不可再流转）
 */
export function isTerminalStatus(status: string): boolean {
  return (
    status === OrderStatus.COMPLETED ||
    status === OrderStatus.CANCELLED ||
    status === OrderStatus.REJECTED
  );
}
