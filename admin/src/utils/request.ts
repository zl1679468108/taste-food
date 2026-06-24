import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 5 * 60 * 1000;

function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DEFAULT_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function clearCache(pattern?: string): void {
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

function buildCacheKey(config: AxiosRequestConfig): string {
  const params = config.params ? JSON.stringify(Object.keys(config.params).sort().reduce((acc, key) => {
    acc[key] = config.params[key];
    return acc;
  }, {} as Record<string, any>)) : '';
  return `${config.method}:${config.url}:${params}`;
}

const request = axios.create({
  baseURL: '/',
  timeout: 10000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.method === 'get') {
    const cacheKey = buildCacheKey(config);
    const cached = getCache(cacheKey);
    if (cached) {
      (config as any).cachedData = cached;
    }
  }

  return config;
});

request.interceptors.response.use(
  (response) => {
    const { data, config } = response;

    if ((config as any).cachedData) {
      return (config as any).cachedData;
    }

    if (data.code !== 0) {
      message.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message));
    }

    if (config.method === 'get') {
      const cacheKey = buildCacheKey(config);
      setCache(cacheKey, data.data);
    }

    return data.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    message.error(error.response?.data?.message || '网络错误');
    return Promise.reject(error);
  }
);

export { clearCache };
export default request;
