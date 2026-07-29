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
  formatRelativeTime,
  truncateText,
} from '@taste-food/shared/format';
import {
  formatTime as sharedFormatTime,
  shortOrderId as sharedShortOrderId,
} from '@taste-food/shared/format';

// admin 历史 formatPrice 返回带 ¥ 符号，映射为 shared 的 formatPriceWithSymbol
export { formatPriceWithSymbol as formatPrice } from '@taste-food/shared/format';

/** PC 端统一展示到秒：YYYY-MM-DD HH:mm:ss */
export function formatTime(time: string, template = 'YYYY-MM-DD HH:mm:ss'): string {
  return sharedFormatTime(time, template);
}

/** 短订单号（去 # 前缀），用于表格紧凑展示 */
export function shortOrderId(id: string): string {
  if (!id) return '-';
  return sharedShortOrderId(id).replace(/^#/, '');
}

/**
 * 订单号展示辅助。
 * - withHash=false（默认）：`A1B2C3D4`
 * - withHash=true：`#A1B2C3D4`
 */
export function formatOrderNo(
  id?: string | null,
  options?: { withHash?: boolean },
): string {
  if (!id) return '-';
  const short = shortOrderId(id);
  return options?.withHash ? `#${short}` : short;
}
