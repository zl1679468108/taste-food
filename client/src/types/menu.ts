/**
 * 菜品相关类型
 *
 * 实际定义已抽取到 @taste-food/shared/types，
 * 此文件作为 re-export 入口，保持现有 import 路径向后兼容。
 */
export type {
  Category,
  SpecOption,
  SpecGroup,
  MenuItem,
  MenuItemWithSpecs,
  SelectedSpec,
} from '@taste-food/shared/types';

// 菜品状态枚举
export { MenuItemStatus } from '@taste-food/shared/constants';
