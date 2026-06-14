import dayjs from 'dayjs';

/**
 * 将分转换为元
 * @param price 价格（单位：分）
 * @returns 格式化后的价格字符串（元）
 * @example formatPrice(6800) => '68.00'
 */
export function formatPrice(price: number): string {
  return (price / 100).toFixed(2);
}

/**
 * 将分转换为元并带符号
 * @param price 价格（单位：分）
 * @returns 格式化后的价格字符串，如 '¥68.00'
 */
export function formatPriceWithSymbol(price: number): string {
  return `¥${formatPrice(price)}`;
}

/**
 * 格式化时间
 * @param time ISO 时间字符串
 * @param template 格式化模板（dayjs 格式）
 * @returns 格式化后的时间字符串
 * @example formatTime('2025-06-15T12:30:00Z') => '2025-06-15 12:30'
 */
export function formatTime(
  time: string,
  template = 'YYYY-MM-DD HH:mm',
): string {
  return dayjs(time).format(template);
}

/**
 * 格式化相对时间
 * @param time ISO 时间字符串
 * @returns 相对时间描述
 * @example formatRelativeTime('2025-06-15T12:30:00Z') => '3 小时前'
 */
export function formatRelativeTime(time: string): string {
  const now = dayjs();
  const target = dayjs(time);
  const diffMinutes = now.diff(target, 'minute');

  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;

  const diffHours = now.diff(target, 'hour');
  if (diffHours < 24) return `${diffHours} 小时前`;

  const diffDays = now.diff(target, 'day');
  if (diffDays < 30) return `${diffDays} 天前`;

  return target.format('YYYY-MM-DD');
}

/**
 * 简短显示订单号
 * @param orderId 完整订单 ID
 * @returns 简短订单号
 */
export function shortOrderId(orderId: string): string {
  return `#${orderId.substring(0, 8).toUpperCase()}`;
}

/**
 * 限制文本长度
 * @param text 原始文本
 * @param maxLength 最大长度
 * @returns 截断后的文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
