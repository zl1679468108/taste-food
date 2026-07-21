/**
 * 金额/时间/订单号格式化工具
 *
 * 实际实现已抽取到 @taste-food/shared/format，
 * 此文件作为 re-export 入口，保持现有 import 路径向后兼容。
 *
 * 注意：admin 端历史 formatPrice 返回带 ¥ 符号（'¥68.00'），
 * 与 shared 包的 formatPrice（'68.00'）不同。
 * 此处将 admin 的 formatPrice 映射为 shared 的 formatPriceWithSymbol，
 * 保持 admin 现有 UI 显示行为不变。
 */
export {
  formatTime,
  formatRelativeTime,
  truncateText,
  shortOrderId,
} from '@taste-food/shared/format';

// admin 历史 formatPrice 返回带 ¥ 符号，映射为 shared 的 formatPriceWithSymbol
export { formatPriceWithSymbol as formatPrice } from '@taste-food/shared/format';
