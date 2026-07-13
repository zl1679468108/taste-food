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
  createdAt: string;
  updatedAt: string;
}
