/** 促销活动类型 */
export interface Promotion {
  id: string;
  shopId: string;
  type: 'full_discount' | 'first_order' | 'coupon';
  name: string;
  description?: string;
  rule: {
    threshold?: number;  // 满减门槛（分）
    discount?: number;   // 优惠金额（分）
  };
  status: 'active' | 'inactive' | 'expired';
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}
