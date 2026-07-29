import { DEFAULT_SHOP_LOGO, resolveShopLogoUrl } from '../src/utils/shop-logo';

describe('resolveShopLogoUrl', () => {
  it('returns default logo when empty', () => {
    expect(resolveShopLogoUrl('')).toBe(DEFAULT_SHOP_LOGO);
    expect(resolveShopLogoUrl(null)).toBe(DEFAULT_SHOP_LOGO);
    expect(resolveShopLogoUrl(undefined)).toBe(DEFAULT_SHOP_LOGO);
    expect(resolveShopLogoUrl('   ')).toBe(DEFAULT_SHOP_LOGO);
  });

  it('returns custom url when provided', () => {
    expect(resolveShopLogoUrl('https://cdn.example.com/logo.png')).toBe(
      'https://cdn.example.com/logo.png',
    );
  });
});
