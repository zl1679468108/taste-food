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
  MERCHANT = 'merchant',
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
  [OrderStatus.READY_FOR_PICKUP]: '待取餐',
  [OrderStatus.DELIVERING]: '配送中',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.CANCELLED]: '已取消',
  [OrderStatus.REJECTED]: '已拒单',
};

/**
 * 按配送类型返回更贴合业务的状态文案
 * - pickup: 待自取
 * - dine_in: 待取餐
 * - delivery: 不使用 ready_for_pickup
 */
export function getOrderStatusLabel(status?: string, deliveryType?: string): string {
  if (!status) return '';
  if (status === OrderStatus.READY_FOR_PICKUP) {
    if (deliveryType === DeliveryType.PICKUP) return '待自取';
    if (deliveryType === DeliveryType.DINE_IN) return '待取餐';
    return '待取餐';
  }
  return ORDER_STATUS_MAP[status] || status;
}

/**
 * 顾客端状态说明（与商家端操作一一对应）
 * 商家：接单/拒单 → 开始制作 → 开始配送/待取餐 → 确认送达/确认取餐
 */
export function getCustomerOrderStatusHint(status?: string, deliveryType?: string): string {
  switch (status) {
    case OrderStatus.PENDING_PAYMENT:
      return '请尽快完成支付，超时订单将自动取消';
    case OrderStatus.PAID:
      return '已支付，等待商家接单';
    case OrderStatus.ACCEPTED:
      return '商家已接单，即将开始制作';
    case OrderStatus.PREPARING:
      return '商家正在制作中，请耐心等待';
    case OrderStatus.READY_FOR_PICKUP:
      return deliveryType === DeliveryType.DINE_IN
        ? '餐品已备好，请到店取餐'
        : '餐品已备好，请到店自取';
    case OrderStatus.DELIVERING:
      return '订单配送中，请留意骑手电话';
    case OrderStatus.COMPLETED:
      return '订单已完成，欢迎再次光临';
    case OrderStatus.CANCELLED:
      return '订单已取消';
    case OrderStatus.REJECTED:
      return '商家已拒单，如已支付将原路退回';
    default:
      return '';
  }
}

/** 商家端下一步主操作文案（与顾客提示对应） */
export function getMerchantOrderActionHint(status?: string, deliveryType?: string): string {
  switch (status) {
    case OrderStatus.PAID:
      return '待接单：可接单或拒单';
    case OrderStatus.ACCEPTED:
      return '已接单：开始制作';
    case OrderStatus.PREPARING:
      if (deliveryType === DeliveryType.DELIVERY) return '制作中：开始配送（商家）或等待骑手';
      if (deliveryType === DeliveryType.DINE_IN) return '制作中：标记待取餐';
      return '制作中：标记待自取';
    case OrderStatus.READY_FOR_PICKUP:
      return '待取餐：确认顾客已取餐';
    case OrderStatus.DELIVERING:
      return '配送中：确认送达';
    default:
      return '';
  }
}

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

/** 用户角色中文映射（admin 默认商家；平台管理员需结合 shop_id 空展示「管理员」） */
export const USER_ROLE_MAP: Record<string, string> = {
  [UserRole.CUSTOMER]: '顾客',
  [UserRole.ADMIN]: '管理员',
  [UserRole.MERCHANT]: '商家',
  [UserRole.RIDER]: '骑手',
};

/** 结合店铺绑定解析角色展示文案 */
export function getUserRoleLabel(role?: string, shopId?: string | null): string {
  if (!role) return '-';
  if (role === UserRole.ADMIN || role === 'admin') return '管理员';
  if (role === UserRole.MERCHANT || role === 'merchant') return '商家';
  return USER_ROLE_MAP[role] || role;
}

export function isShopOperator(role?: string): boolean {
  return role === UserRole.MERCHANT || role === UserRole.ADMIN;
}

/**
 * 订单状态流转规则（与 server 端 order.service.ts validateStatusTransition 保持一致）
 * key: 当前状态，value: 可流转到的下一状态列表
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING],
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
