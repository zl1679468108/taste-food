import request from '@/utils/request';

export interface Category {
  id: string;
  shopId: string;
  name: string;
  sortOrder: number;
  iconKey: string;
}

export interface MenuItem {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  price: number;
  imageUrl: string;
  description: string;
  status: string;
  salesCount: number;
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