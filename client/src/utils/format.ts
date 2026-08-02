/**
 * 金额/时间/订单号格式化工具
 *
 * 实际实现已抽取到 @taste-food/shared/format，
 * 此文件作为 re-export 入口，保持现有 import 路径向后兼容。
 */
export {
  formatPrice,
  formatPriceWithSymbol,
  formatTime,
  formatRelativeTime,
  shortOrderId,
  pickupCode,
  truncateText,
} from '@taste-food/shared/format';
