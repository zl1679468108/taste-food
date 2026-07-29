import defaultShopLogo from '@/assets/images/shop-logo-default.png';

/** 店铺未上传 / 图片失效时使用的默认 Logo */
export const DEFAULT_SHOP_LOGO = defaultShopLogo;

export function resolveShopLogoUrl(logoUrl?: string | null): string {
  const url = (logoUrl || '').trim();
  return url || DEFAULT_SHOP_LOGO;
}
