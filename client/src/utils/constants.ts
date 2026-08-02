/**
 * 状态枚举常量
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
  ORDER_REMARK_TAGS_COMMON,
  ORDER_REMARK_TAGS_PICKUP,
  getRemarkTagsByDeliveryType,
  ORDER_STATUS_COLOR_MAP,
  PROMOTION_TYPE_MAP,
  USER_ROLE_MAP,
  ORDER_STATUS_TRANSITIONS,
  canTransitionTo,
  isTerminalStatus,
  getOrderStatusLabel,
  getCustomerOrderStatusHint,
  getMerchantOrderActionHint,
  PAYMENT_TIMEOUT_MINUTES,
  ORDER_URGE_COOLDOWN_MINUTES,
  CUSTOMER_CANCELLABLE_STATUSES,
  CUSTOMER_CANCEL_REQUESTABLE_STATUSES,
  CUSTOMER_ACTIVE_ORDER_STATUSES,
  CUSTOMER_HISTORY_ORDER_STATUSES,
  CUSTOMER_REFUND_ORDER_STATUSES,
  isRefundOrderListFilter,
  resolveOrderStatusFilter,
  isAfterSaleOrder,
  getCustomerAfterSaleTitle,
  getCustomerAfterSaleHint,
  buildAfterSaleSteps,
  getMerchantAfterSaleLabel,
} from '@taste-food/shared/constants';

export type { AfterSaleStep, AfterSaleViewInput, PaymentRecordStatus } from '@taste-food/shared/constants';
