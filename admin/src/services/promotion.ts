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

export interface PromotionConflictResult {
  hasConflict: boolean;
  conflicts: Promotion[];
}

export interface PromotionConflictQuery {
  type: string;
  /** 省略表示无开始时间（即刻生效） */
  startTime?: string;
  /** 省略表示无结束时间（长期有效） */
  endTime?: string;
  /** 编辑时排除自身 */
  excludeId?: string;
  shopId?: string;
}

/**
 * 检测同店铺、同类型促销的时间段重叠。
 * 结果是「警告」不是「阻断」——调用方需要把决定权交回给用户。
 */
export const checkPromotionConflicts = (query: PromotionConflictQuery) =>
  request.get('/api/merchant/promotions/conflicts', {
    params: {
      type: query.type,
      startTime: query.startTime,
      endTime: query.endTime,
      excludeId: query.excludeId,
      shop_id: query.shopId,
    },
  }) as Promise<PromotionConflictResult>;

/** 管理端读取指定店铺全部活动（传 shop_id 支持多店切换）。 */
export const getPromotions = (shopId?: string) =>
  request.get('/api/merchant/promotions/manage', {
    params: shopId ? { shop_id: shopId } : undefined,
  }) as Promise<Promotion[]>;

export const createPromotion = (data: Partial<Promotion>) =>
  request.post('/api/merchant/promotions', data) as Promise<Promotion>;

export const updatePromotion = (id: string, data: Partial<Promotion>, shopId?: string) =>
  request.patch(`/api/merchant/promotions/${id}`, data, {
    params: shopId ? { shop_id: shopId } : undefined,
  });

export const deletePromotion = (id: string, shopId?: string) =>
  request.delete(`/api/merchant/promotions/${id}`, {
    params: shopId ? { shop_id: shopId } : undefined,
  });
