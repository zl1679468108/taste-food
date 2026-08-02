import request from '@/utils/request';

export interface Category {
  id: string;
  shopId: string;
  name: string;
  sortOrder: number;
  iconKey: string;
}

export interface SpecOption {
  id: string;
  specGroupId: string;
  name: string;
  priceAdjust: number; // 单位：分
  isDefault: boolean;
}

export interface SpecGroup {
  id: string;
  shopId: string;
  name: string;
  isRequired: boolean;
  maxSelect: number;
  options: SpecOption[];
}

export interface MenuItem {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  price: number; // 单位：分
  imageUrl: string;
  description: string;
  status: string;
  salesCount: number;
  /** 关联规格组 ID */
  specGroupIds?: string[];
  /** 规格明细（列表一次返回） */
  specs?: SpecGroup[];
}

export const getCategories = (shopId: string) =>
  request.get('/api/categories', { params: { shop_id: shopId } }) as Promise<Category[]>;

export const createCategory = (data: Partial<Category>) =>
  request.post('/api/categories', data) as Promise<Category>;

export const updateCategory = (id: string, data: Partial<Category>) =>
  request.patch(`/api/categories/${id}`, data);

export const deleteCategory = (id: string) =>
  request.delete(`/api/categories/${id}`);

export const getMenuItems = (params: { shop_id: string; category_id?: string; search?: string }) =>
  request.get('/api/menu-items', { params }) as Promise<MenuItem[]>;

export const createMenuItem = (data: Partial<MenuItem>) =>
  request.post('/api/menu-items', data) as Promise<MenuItem>;

export const updateMenuItem = (id: string, data: Partial<MenuItem>) =>
  request.patch(`/api/menu-items/${id}`, data);

export const deleteMenuItem = (id: string) =>
  request.delete(`/api/menu-items/${id}`);

/** 批量上/下架请求参数 */
export interface BatchMenuItemStatusParams {
  ids: string[];
  /** true=上架，false=下架 */
  isAvailable: boolean;
  shopId?: string;
}

/** 批量上/下架结果 */
export interface BatchMenuItemStatusResult {
  /** 实际更新成功的菜品数量 */
  updated: number;
}

export const batchUpdateMenuItemStatus = (params: BatchMenuItemStatusParams) =>
  request.patch('/api/menu-items/batch-status', params) as Promise<BatchMenuItemStatusResult>;
export const getSpecGroups = (shopId: string) =>
  request.get('/api/spec-groups', { params: { shop_id: shopId } }) as Promise<SpecGroup[]>;

/** 规格组内嵌选项入参：带 id 表示保留更新，不带表示新增 */
export interface SpecGroupOptionInput {
  id?: string;
  name: string;
  /** 价格修正（单位：分），可为负数 */
  priceAdjust?: number;
  isDefault?: boolean;
}

export interface CreateSpecGroupInput {
  shopId: string;
  name: string;
  isRequired?: boolean;
  maxSelect?: number;
  /** 传入即按全量替换处理；不传表示不改动现有选项 */
  options?: SpecGroupOptionInput[];
}

export const createSpecGroup = (data: CreateSpecGroupInput) =>
  request.post('/api/spec-groups', data) as Promise<SpecGroup>;

export const updateSpecGroup = (id: string, data: Partial<CreateSpecGroupInput>) =>
  request.patch(`/api/spec-groups/${id}`, data) as Promise<SpecGroup>;

export const deleteSpecGroup = (id: string) =>
  request.delete(`/api/spec-groups/${id}`) as Promise<void>;
