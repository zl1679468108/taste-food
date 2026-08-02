import type { Order } from '@/services/order';
import { shortOrderId } from '@/utils/format';

/** 优先业务单号，否则短 id */
export function displayOrderNo(order: Pick<Order, 'id' | 'orderNo' | 'order_no'>): string {
  return order.orderNo || order.order_no || shortOrderId(order.id);
}
