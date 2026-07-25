/**
 * 订单相关类型
 *
 * 实际定义已抽取到 @taste-food/shared/types，
 * 此文件作为 re-export 入口，保持现有 import 路径向后兼容。
 */
export type {
  OrderItem,
  DeliveryInfo,
  DeliveryTrackPoint,
  Order,
  OrderStatusHistoryItem,
} from '@taste-food/shared/types';

// 枚举需要用 export 而非 export type
export { OrderStatus, DeliveryType } from '@taste-food/shared/constants';
