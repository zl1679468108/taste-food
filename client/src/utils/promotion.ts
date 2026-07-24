import type { Promotion } from '../types/promotion';

/**
 * 客户端预估优惠金额（分）
 * 与服务端 full_discount 规则对齐；首单优惠以后端为准，此处不预估
 */
export function estimateDiscount(promotions: Promotion[], subtotal: number): number {
  let discount = 0;
  for (const promo of promotions) {
    if (promo.type === 'full_discount') {
      const rule = promo.rule || {};
      if (subtotal >= (rule.threshold || 0)) {
        discount = Math.max(discount, rule.discount || 0);
      }
    }
  }
  return discount;
}
