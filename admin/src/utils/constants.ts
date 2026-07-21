/**
 * 全局共享常量
 *
 * 实际定义已抽取到 @taste-food/shared/constants，
 * 此文件作为 re-export 入口，保持现有 import 路径向后兼容。
 */
export {
  OrderStatus,
  DeliveryType,
  MenuItemStatus,
  ShopStatus,
  UserRole,
  PromotionType,
  PromotionStatus,
  DEFAULT_SHOP_ID,
  ORDER_STATUS_MAP,
  DELIVERY_TYPE_MAP,
  ORDER_STATUS_COLOR_MAP,
  PROMOTION_TYPE_MAP,
  USER_ROLE_MAP,
  ORDER_STATUS_TRANSITIONS,
  canTransitionTo,
  isTerminalStatus,
} from '@taste-food/shared/constants';
