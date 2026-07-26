/**
 * 分类图标映射
 * 数据库只存 icon_key，前端根据 key 映射为 SVG IconName
 */
import type { IconName } from '../components/Icon';

export const CATEGORY_ICONS: Record<string, IconName> = {
  star: 'star',
  meat: 'meat',
  vegetable: 'vegetable',
  drink: 'drink',
  rice: 'rice',
  hot: 'hot',
};

/** 兜底图标 */
export const DEFAULT_CATEGORY_ICON: IconName = 'list';

/** 根据 icon_key 获取 SVG 图标名 */
export function getCategoryIcon(iconKey?: string): IconName {
  if (!iconKey) return DEFAULT_CATEGORY_ICON;
  return CATEGORY_ICONS[iconKey] || DEFAULT_CATEGORY_ICON;
}

/** 订单状态对应图标 */
export function getOrderStatusIcon(status?: string): IconName {
  switch (status) {
    case 'pending_payment':
      return 'clock';
    case 'paid':
    case 'accepted':
    case 'preparing':
    case 'delivering':
    case 'ready_for_pickup':
      return 'order';
    case 'completed':
      return 'check';
    case 'cancelled':
    case 'rejected':
      return 'close';
    default:
      return 'order';
  }
}
