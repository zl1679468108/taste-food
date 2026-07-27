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

export enum DeliveryType {
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
  DINE_IN = 'dine_in',
}

export enum MenuItemStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum ShopStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  RIDER = 'rider',
  MERCHANT = 'merchant',
}

/** 店铺运营角色（单店写权限） */
export function isShopOperator(role?: string): boolean {
  return role === UserRole.MERCHANT || role === UserRole.ADMIN;
}

/** 平台管理员 */
export function isPlatformAdmin(role?: string, shopId?: string | null): boolean {
  return role === UserRole.ADMIN && !shopId;
}

export enum PromotionType {
  FULL_DISCOUNT = 'full_discount',
  FIRST_ORDER = 'first_order',
  COUPON = 'coupon',
}

export enum PromotionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
}
