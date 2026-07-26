/**
 * 小程序菜单本地缓存（按 shopId）
 * key: tf:menu:{shopId}
 * value: { items, updatedAt }（items 含 imageUrl，进店可先展示再后台刷新）
 */
import * as TaroImport from '@tarojs/taro';
import type { MenuItem } from '../types/menu';

const Taro = (TaroImport as typeof TaroImport & { default?: typeof TaroImport }).default || TaroImport;

const KEY_PREFIX = 'tf:menu:';

export interface MenuCachePayload {
  /** 菜单菜品列表（含 imageUrl） */
  items: MenuItem[];
  /** 写入时间戳 ms */
  updatedAt: number;
}

export function getMenuCacheKey(shopId: string): string {
  return `${KEY_PREFIX}${shopId}`;
}

export function loadMenuCache(shopId: string): MenuCachePayload | null {
  if (!shopId) return null;
  try {
    const raw = Taro.getStorageSync(getMenuCacheKey(shopId));
    if (!raw) return null;

    const parsed: MenuCachePayload =
      typeof raw === 'string' ? (JSON.parse(raw) as MenuCachePayload) : (raw as MenuCachePayload);

    if (!parsed || !Array.isArray(parsed.items) || typeof parsed.updatedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    try {
      Taro.removeStorageSync(getMenuCacheKey(shopId));
    } catch {
      // ignore
    }
    return null;
  }
}

export function saveMenuCache(shopId: string, items: MenuItem[]): void {
  if (!shopId || !Array.isArray(items)) return;
  const payload: MenuCachePayload = {
    items,
    updatedAt: Date.now(),
  };
  try {
    Taro.setStorageSync(getMenuCacheKey(shopId), JSON.stringify(payload));
  } catch (error) {
    console.warn('[menu-cache] save failed:', error);
  }
}

export function clearMenuCache(shopId?: string): void {
  try {
    if (shopId) {
      Taro.removeStorageSync(getMenuCacheKey(shopId));
      return;
    }
    const info = Taro.getStorageInfoSync?.();
    const keys = info?.keys || [];
    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith(KEY_PREFIX)) {
        Taro.removeStorageSync(key);
      }
    }
  } catch (error) {
    console.warn('[menu-cache] clear failed:', error);
  }
}
