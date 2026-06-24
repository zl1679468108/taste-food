import request from '@/utils/request';

export interface Promotion {
  id: string;
  shopId: string;
  type: string;
  name: string;
  description: string;
  rule: any;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const getPromotions = (shopId: string) =>
  request.get('/api/promotions', { params: { shopId } }) as Promise<Promotion[]>;

export const createPromotion = (data: Partial<Promotion>) =>
  request.post('/api/promotions', data) as Promise<Promotion>;

export const updatePromotion = (id: string, data: Partial<Promotion>) =>
  request.patch(`/api/promotions/${id}`, data);

export const deletePromotion = (id: string) =>
  request.delete(`/api/promotions/${id}`);