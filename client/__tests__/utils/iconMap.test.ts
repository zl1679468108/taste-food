import { getCategoryIcon, CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, getOrderStatusIcon } from '../../src/utils/iconMap';

describe('iconMap utils', () => {
  test('getCategoryIcon should return correct SVG icon names for valid keys', () => {
    expect(getCategoryIcon('star')).toBe('star');
    expect(getCategoryIcon('meat')).toBe('meat');
    expect(getCategoryIcon('vegetable')).toBe('vegetable');
    expect(getCategoryIcon('drink')).toBe('drink');
    expect(getCategoryIcon('rice')).toBe('rice');
    expect(getCategoryIcon('hot')).toBe('hot');
  });

  test('getCategoryIcon should return default icon for invalid keys', () => {
    expect(getCategoryIcon('invalid')).toBe(DEFAULT_CATEGORY_ICON);
    expect(getCategoryIcon('')).toBe(DEFAULT_CATEGORY_ICON);
    expect(getCategoryIcon(undefined)).toBe(DEFAULT_CATEGORY_ICON);
  });

  test('CATEGORY_ICONS should have all required icons', () => {
    expect(CATEGORY_ICONS).toHaveProperty('star');
    expect(CATEGORY_ICONS).toHaveProperty('meat');
    expect(CATEGORY_ICONS).toHaveProperty('vegetable');
    expect(CATEGORY_ICONS).toHaveProperty('drink');
    expect(CATEGORY_ICONS).toHaveProperty('rice');
    expect(CATEGORY_ICONS).toHaveProperty('hot');
  });

  test('DEFAULT_CATEGORY_ICON should be list SVG name', () => {
    expect(DEFAULT_CATEGORY_ICON).toBe('list');
  });

  test('getOrderStatusIcon maps known statuses', () => {
    expect(getOrderStatusIcon('pending_payment')).toBe('clock');
    expect(getOrderStatusIcon('completed')).toBe('check');
    expect(getOrderStatusIcon('cancelled')).toBe('close');
    expect(getOrderStatusIcon('unknown')).toBe('order');
  });
});
