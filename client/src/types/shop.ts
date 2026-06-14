/** 店铺接口 */
export interface Shop {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
}
