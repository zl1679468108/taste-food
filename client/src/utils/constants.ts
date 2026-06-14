/**
 * 状态枚举常量
 * 与后端 common/constants/enums.ts 保持一致
 */

export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  ACCEPTED = 'accepted',
  PREPARING = 'preparing',
  DELIVERING = 'delivering',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

export enum DeliveryType {
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
  DINE_IN = 'dine_in',
}

export enum MenuItemStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/** 订单状态中文映射 */
export const ORDER_STATUS_MAP: Record<string, string> = {
  [OrderStatus.PENDING_PAYMENT]: '待支付',
  [OrderStatus.PAID]: '已支付',
  [OrderStatus.ACCEPTED]: '已接单',
  [OrderStatus.PREPARING]: '制作中',
  [OrderStatus.DELIVERING]: '配送中',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.CANCELLED]: '已取消',
  [OrderStatus.REJECTED]: '已拒绝',
};

/** 配送方式中文映射 */
export const DELIVERY_TYPE_MAP: Record<string, string> = {
  [DeliveryType.DELIVERY]: '外卖配送',
  [DeliveryType.PICKUP]: '到店自取',
  [DeliveryType.DINE_IN]: '堂食',
};

/** 订单状态颜色映射 */
export const ORDER_STATUS_COLOR_MAP: Record<string, string> = {
  [OrderStatus.PENDING_PAYMENT]: '#f59e0b', // 黄色
  [OrderStatus.PAID]: '#3b82f6',             // 蓝色
  [OrderStatus.ACCEPTED]: '#8b5cf6',          // 紫色
  [OrderStatus.PREPARING]: '#f97316',         // 橙色
  [OrderStatus.DELIVERING]: '#06b6d4',        // 青色
  [OrderStatus.COMPLETED]: '#22c55e',         // 绿色
  [OrderStatus.CANCELLED]: '#6b7280',         // 灰色
  [OrderStatus.REJECTED]: '#ef4444',          // 红色
};
