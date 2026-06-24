/** 菜品分类 */
export interface Category {
  id: string;
  shopId: string;
  name: string;
  sortOrder: number;
  iconKey?: string;
  createdAt: string;
  updatedAt: string;
}

/** 菜品 */
export interface MenuItem {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  price: number;
  imageUrl?: string;
  description?: string;
  status: 'active' | 'inactive';
  salesCount: number;
  specGroupIds?: string[];
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 规格选项 */
export interface SpecOption {
  id: string;
  specGroupId: string;
  name: string;
  priceAdjust: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 规格组 */
export interface SpecGroup {
  id: string;
  shopId: string;
  name: string;
  isRequired: boolean;
  maxSelect: number;
  options: SpecOption[];
  createdAt: string;
  updatedAt: string;
}

/** 带有规格的菜品（购物车/详情使用） */
export interface MenuItemWithSpecs extends MenuItem {
  specs?: SpecGroup[];
}

/** 选中的规格 */
export interface SelectedSpec {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceAdjust: number;
}
