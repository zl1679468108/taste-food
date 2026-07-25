import * as TaroImport from '@tarojs/taro';

const Taro = (TaroImport as typeof TaroImport & { default?: typeof TaroImport }).default || TaroImport;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
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
  const normalizedPattern = getCacheResourceKey(pattern);
  // 精确匹配资源段：避免 'orders' 误匹配 'order-items' 等
  // cache key 格式为 `method:url:params`，提取 url 段比对资源 key
  for (const key of cache.keys()) {
    if (key === pattern) {
      cache.delete(key);
      continue;
    }
    const parts = key.split(':');
    const url = parts.length >= 2 ? parts.slice(1, -1).join(':') : key;
    const resourceKey = getCacheResourceKey(url);
    if (resourceKey === normalizedPattern) {
      cache.delete(key);
    }
  }
}

export function getCacheResourceKey(url: string): string {
  const normalizedUrl =
    url.startsWith('/') || /^https?:\/\//i.test(url) || /^[A-Z]+:/i.test(url) ? url : `/${url}`;
  const path = normalizedUrl
    .replace(/^[A-Z]+:/, '')
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/api\/?/, '/')
    .split(/[?:]/)[0]
    .replace(/^\/+/, '');
  return path.split('/')[0] || path || url;
}

export function clearResourceCache(url: string): void {
  const resourceKey = getCacheResourceKey(url);
  clearCache(resourceKey);
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
    // 数据损坏：清除无效缓存项，避免反复 parse 失败
    try {
      Taro.removeStorageSync(`cache_${key}`);
    } catch {}
    return null;
  }
}

/** 主动清理内存中所有过期缓存项，避免长期运行内存持续增长 */
export function purgeExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > DEFAULT_TTL) {
      cache.delete(key);
    }
  }
}

export function setStorageCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    Taro.setStorageSync(`cache_${key}`, JSON.stringify(entry));
  } catch {}
}
