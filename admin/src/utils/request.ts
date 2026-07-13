import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { message } from 'antd';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// 缓存仅用于显式声明 useCache 的请求，管理后台数据默认不缓存
const cache = new Map<string, CacheEntry<unknown>>();
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
  }, {} as Record<string, unknown>)) : '';
  return `${config.method}:${config.url}:${params}`;
}

function getCacheResourceKey(url: string): string {
  const path = url
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/api\/?/, '/')
    .split('?')[0]
    .replace(/^\/+/, '');
  return path.split('/')[0] || path || url;
}

function clearResourceCache(url: string): void {
  clearCache(getCacheResourceKey(url));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || '网络错误');
}

function clearAuthAndRedirect(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  // 避免在登录页循环跳转
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// 扩展 AxiosRequestConfig 以支持 useCache 选项
declare module 'axios' {
  interface AxiosRequestConfig {
    /** 显式启用 GET 缓存（默认不缓存，管理后台需实时数据） */
    useCache?: boolean;
    cachedData?: unknown;
    /** 内部标记：本次请求为 refresh 重试，避免循环 */
    _isRefreshRetry?: boolean;
  }
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

  // 仅当显式声明 useCache: true 时才使用缓存
  if (config.method === 'get' && config.useCache) {
    const cacheKey = buildCacheKey(config);
    const cached = getCache(cacheKey);
    if (cached) {
      config.cachedData = cached;
    }
  }

  return config;
});

// refresh token 并发控制：同时多个 401 时只刷新一次
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('no refresh token');
  }
  refreshPromise = (async () => {
    // 直接用 axios 调用，绕过自身拦截器，避免 401 循环
    const resp = await axios.post('/api/auth/refresh', { refreshToken });
    const body = resp.data;
    if (!body || body.code !== 0 || !body.data || !body.data.token) {
      throw new Error('refresh failed');
    }
    const { token: newToken, refreshToken: newRefresh } = body.data;
    localStorage.setItem('token', newToken);
    if (newRefresh) localStorage.setItem('refreshToken', newRefresh);
    return newToken as string;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

request.interceptors.response.use(
  (response) => {
    const { data, config } = response;

    // 命中缓存时直接返回缓存数据
    if (config.cachedData) {
      return config.cachedData;
    }

    if (data.code !== 0) {
      message.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message));
    }

    // 仅当显式声明 useCache 时才写入缓存
    if (config.method === 'get' && config.useCache) {
      const cacheKey = buildCacheKey(config);
      setCache(cacheKey, data.data);
    } else if (config.method !== 'get' && config.url) {
      // 写操作清除相关资源缓存
      clearResourceCache(config.url);
    }

    return data.data;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as (AxiosRequestConfig & { _isRefreshRetry?: boolean }) | undefined;
    // 401：尝试 refresh 后重试一次，失败再清除登录态
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._isRefreshRetry &&
      !originalRequest.url?.includes('/api/auth/refresh') &&
      !originalRequest.url?.includes('/api/auth/wechat-login')
    ) {
      try {
        const newToken = await doRefresh();
        originalRequest._isRefreshRetry = true;
        originalRequest.headers = originalRequest.headers || {};
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return request(originalRequest);
      } catch (e) {
        clearAuthAndRedirect();
        message.error('登录已过期，请重新登录');
        return Promise.reject(e);
      }
    }
    if (error.response?.status === 401) {
      clearAuthAndRedirect();
    }
    const respData = error.response?.data as { message?: string } | undefined;
    message.error(respData?.message || getErrorMessage(error));
    return Promise.reject(error);
  }
);

export { clearCache };
export default request;
