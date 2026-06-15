/**
 * 分类图标映射
 * 数据库只存 icon_key，前端根据 key 映射为 emoji 展示
 * 如需更换图标风格，只需修改此文件，无需改数据库
 */

export const CATEGORY_ICONS: Record<string, string> = {
  star: '🌟',
  meat: '🥩',
  vegetable: '🥬',
  drink: '🍺',
  rice: '🍚',
};

/** 兜底图标 */
export const DEFAULT_CATEGORY_ICON = '📋';

/** 根据 icon_key 获取 emoji */
export function getCategoryIcon(iconKey?: string): string {
  return (iconKey && CATEGORY_ICONS[iconKey]) || DEFAULT_CATEGORY_ICON;
}
