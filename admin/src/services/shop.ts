import request from '@/utils/request';

export interface Shop {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  logoUrl: string;
  status: string;
  deliveryRange: number;
  deliveryFee: number;
  minOrderAmount: number;
  createdAt: string;
  updatedAt: string;
}

export const getShops = () =>
  request.get('/api/shops') as Promise<Shop[]>;

export const getShop = (id: string) =>
  request.get(`/api/shops/${id}`) as Promise<Shop>;

export const createShop = (data: Partial<Shop>) =>
  request.post('/api/shops', data) as Promise<Shop>;

export const updateShop = (id: string, data: Partial<Shop>) =>
  request.patch(`/api/shops/${id}`, data) as Promise<Shop>;

export const updateShopStatus = (id: string, status: string) =>
  request.patch(`/api/shops/${id}/status`, { status }) as Promise<Shop>;

export const deleteShop = (id: string) =>
  request.delete(`/api/shops/${id}`);
