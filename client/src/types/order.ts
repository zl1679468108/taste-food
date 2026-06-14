/** 订单状态枚举 */
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

/** 配送方式枚举 */
export enum DeliveryType {
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
  DINE_IN = 'dine_in',
}

/** 订单项 */
export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  specDesc?: string;
  imageUrl?: string;
}

/** 配送信息 */
export interface DeliveryInfo {
  id: string;
  orderId: string;
  type: DeliveryType;
  address?: string;
  tableNo?: string;
  contactName?: string;
  contactPhone?: string;
}

/** 订单 */
export interface Order {
  id: string;
  shopId: string;
  userId: string;
  status: OrderStatus;
  total: number;
  deliveryType: DeliveryType;
  address?: string;
  tableNo?: string;
  remark?: string;
  contactName?: string;
  contactPhone?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}
