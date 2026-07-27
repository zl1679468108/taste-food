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

/** 管理端读取指定店铺全部活动（传 shop_id 支持多店切换）。 */
export const getPromotions = (shopId?: string) =>
  request.get('/api/promotions/manage', {
    params: shopId ? { shop_id: shopId } : undefined,
  }) as Promise<Promotion[]>;

export const createPromotion = (data: Partial<Promotion>) =>
  request.post('/api/promotions', data) as Promise<Promotion>;

export const updatePromotion = (id: string, data: Partial<Promotion>, shopId?: string) =>
  request.patch(`/api/promotions/${id}`, data, {
    params: shopId ? { shop_id: shopId } : undefined,
  });

export const deletePromotion = (id: string, shopId?: string) =>
  request.delete(`/api/promotions/${id}`, {
    params: shopId ? { shop_id: shopId } : undefined,
  });
