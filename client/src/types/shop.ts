/** 营业日 key */
export type BusinessDayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface BusinessTimeRange {
  start: string;
  end: string;
}

export type BusinessHours = Record<BusinessDayKey, BusinessTimeRange[]>;

/** 店铺接口 */
export interface Shop {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  status: 'open' | 'closed';
  deliveryFee?: number; // 配送费（分）
  minOrderAmount?: number; // 起送价（分）
  businessHours?: BusinessHours;
  isOpenNow?: boolean;
  nextOpenHint?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessHoursInfo {
  shopId: string;
  status: 'open' | 'closed';
  businessHours: BusinessHours;
  isOpenNow: boolean;
  nextOpenHint: string | null;
}
