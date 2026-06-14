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

export enum ShopStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}
