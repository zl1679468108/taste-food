import { SetMetadata } from '@nestjs/common';

export const SHOP_SCOPE_KEY = 'shopScope';

/** 店铺作用域：platform=仅平台管理员，merchant=仅商家，缺省=不限制（向后兼容） */
export type ShopScope = 'platform' | 'merchant';

/**
 * 标记接口仅允许平台管理员（role=admin 且 shopId 空）访问。
 * 用于平台治理类接口（审批、审计、账号管理等），deny-by-default。
 */
export const PlatformOnly = () => SetMetadata(SHOP_SCOPE_KEY, 'platform' as ShopScope);

/**
 * 标记接口仅允许商家（role=merchant 或 admin+shopId）访问。
 * 用于商家单店运营接口。
 */
export const MerchantOnly = () => SetMetadata(SHOP_SCOPE_KEY, 'merchant' as ShopScope);
