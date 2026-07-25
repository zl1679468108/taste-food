import request from '@/utils/request';

export type BusinessDayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface BusinessTimeRange {
  start: string;
  end: string;
}

export type BusinessHours = Record<BusinessDayKey, BusinessTimeRange[]>;

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
  businessHours?: BusinessHours;
  isOpenNow?: boolean;
  nextOpenHint?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessHoursInfo {
  shopId: string;
  status: string;
  businessHours: BusinessHours;
  isOpenNow: boolean;
  nextOpenHint: string | null;
}

export const getShops = () =>
  request.get('/api/shops') as Promise<Shop[]>;

export const getShop = (id: string) =>
  request.get(`/api/shops/${id}`) as Promise<Shop>;

export const getBusinessHours = (id: string) =>
  request.get(`/api/shops/${id}/business-hours`) as Promise<BusinessHoursInfo>;

export const createShop = (data: Partial<Shop>) =>
  request.post('/api/shops', data) as Promise<Shop>;

export const updateShop = (id: string, data: Partial<Shop>) =>
  request.patch(`/api/shops/${id}`, data) as Promise<Shop>;

export const updateBusinessHours = (id: string, businessHours: BusinessHours) =>
  request.patch(`/api/shops/${id}/business-hours`, { businessHours }) as Promise<Shop>;

export const updateShopStatus = (id: string, status: string) =>
  request.patch(`/api/shops/${id}/status`, { status }) as Promise<Shop>;

export const deleteShop = (id: string) =>
  request.delete(`/api/shops/${id}`);
