import * as TaroImport from '@tarojs/taro';

const Taro = (TaroImport as typeof TaroImport & { default?: typeof TaroImport }).default || TaroImport;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 5 * 60 * 1000;

export function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DEFAULT_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

export function getStorageCache<T>(key: string): T | null {
  try {
    const raw = Taro.getStorageSync(`cache_${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > DEFAULT_TTL) {
      Taro.removeStorageSync(`cache_${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setStorageCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    Taro.setStorageSync(`cache_${key}`, JSON.stringify(entry));
  } catch {}
}
