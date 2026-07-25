import request from '@/utils/request';

export interface Promotion {
  id: string;
  shopId: string;
  type: string;
  name: string;
  description: string;
  rule: Record<string, unknown>;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** 管理端读取本店全部活动，店铺归属由服务端 JWT 决定。 */
export const getPromotions = (_shopId?: string) =>
  request.get('/api/promotions/manage') as Promise<Promotion[]>;

export const createPromotion = (data: Partial<Promotion>) =>
  request.post('/api/promotions', data) as Promise<Promotion>;

export const updatePromotion = (id: string, data: Partial<Promotion>) =>
  request.patch(`/api/promotions/${id}`, data);

export const deletePromotion = (id: string) =>
  request.delete(`/api/promotions/${id}`);
