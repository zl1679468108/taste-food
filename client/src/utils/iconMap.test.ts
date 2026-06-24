import { getCategoryIcon, CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from './iconMap';

describe('iconMap utils', () => {
  test('getCategoryIcon should return correct emoji for valid keys', () => {
    expect(getCategoryIcon('star')).toBe('🌟');
    expect(getCategoryIcon('meat')).toBe('🥩');
    expect(getCategoryIcon('vegetable')).toBe('🥬');
    expect(getCategoryIcon('drink')).toBe('🍺');
    expect(getCategoryIcon('rice')).toBe('🍚');
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
  });

  test('DEFAULT_CATEGORY_ICON should be a valid emoji', () => {
    expect(DEFAULT_CATEGORY_ICON).toBe('📋');
  });
});
