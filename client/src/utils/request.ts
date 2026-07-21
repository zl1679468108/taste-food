import * as TaroImport from '@tarojs/taro';
import { API_BASE_URL } from '../env';
import { ApiResponse } from '../types/api';
import { getCache, setCache, clearResourceCache } from './cache';
import { useAuthStore } from '../stores/authStore';

const Taro = (TaroImport as typeof TaroImport & { default?: typeof TaroImport }).default || TaroImport;

/** 请求方法类型 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type RequestData = Record<string, unknown>;

/** 请求选项 */
interface RequestOptions {
  /** 请求头 */
  headers?: Record<string, string>;
  /** 超时时间 (ms) */
  timeout?: number;
  /** 是否显示错误提示（默认 true） */
  showError?: boolean;
  /** 是否使用缓存（仅 GET 有效） */
  useCache?: boolean;
  /** 缓存 key */
  cacheKey?: string;
}

/**
 * 获取存储的 token
 */
function getToken(): string | null {
  try {
    return Taro.getStorageSync('token') || null;
  } catch {
    return null;
  }
}

/**
 * 构建缓存 key
 */
function buildCacheKey(method: string, url: string, data?: RequestData): string {
  const sortedParams = data ? JSON.stringify(Object.keys(data).sort().reduce((acc, key) => {
    acc[key] = data[key];
    return acc;
  }, {} as RequestData)) : '';
  return `${method}:${url}:${sortedParams}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '未知错误');
}

/**
 * 统一请求处理
 */
async function request<T>(
  method: HttpMethod,
  url: string,
  data?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const cacheKey = options?.cacheKey || buildCacheKey(method, fullUrl, data);

  if (method === 'GET' && options?.useCache !== false) {
    const cached = getCache<ApiResponse<T>>(cacheKey);
    if (cached) return cached;
  }

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await Taro.request({
      url: fullUrl,
      method,
      data,
      header: headers,
      timeout: options?.timeout || 10000,
    });

    const responseData = response.data as ApiResponse<T>;

    if (responseData.code !== 0) {
      if (responseData.code === 401) {
        // 401 联动 authStore.logout：统一清理 token/refreshTimer/socket 状态
        const pages = Taro.getCurrentPages();
        const currentPage = pages[pages.length - 1];
        const isLoginPage = currentPage?.route === 'pages/auth/login';
        if (!isLoginPage) {
          Taro.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
          // 延迟调用 logout，避免在请求拦截中立即触发 reLaunch 导致页面栈混乱
          setTimeout(() => {
            useAuthStore.getState().logout();
          }, 1500);
        } else {
          // 已在登录页则只清状态，不跳转
          try {
            useAuthStore.getState().stopAutoRefresh();
          } catch {
            // ignore
          }
        }
      }

      if (options?.showError !== false && responseData.message) {
        Taro.showToast({ title: responseData.message, icon: 'none' });
      }

      throw new RequestError(responseData.message || '请求失败', responseData.code);
    }

    if (method === 'GET' && options?.useCache !== false) {
      setCache(cacheKey, responseData);
    }

    return responseData;
  } catch (error: unknown) {
    const err = error as { errno?: number; message?: string };
    if (err.errno || err.message === 'Network request failed') {
      const errMsg = '网络连接失败，请检查网络';
      if (options?.showError !== false) {
        Taro.showToast({ title: errMsg, icon: 'none' });
      }
      throw new RequestError(errMsg, -1);
    }

    if (error instanceof RequestError) {
      throw error;
    }

    throw new RequestError(getErrorMessage(error), -2);
  }
}

/** 请求错误类 */
export class RequestError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'RequestError';
    this.code = code;
  }
}

/** GET 请求 */
export function get<T>(
  url: string,
  params?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('GET', url, params, options);
}

/** POST 请求 */
export async function post<T>(
  url: string,
  data?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const result = await request<T>('POST', url, data, options);
  clearResourceCache(url);
  return result;
}

/** PUT 请求 */
export async function put<T>(
  url: string,
  data?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const result = await request<T>('PUT', url, data, options);
  clearResourceCache(url);
  return result;
}

/** DELETE 请求 */
export async function del<T>(
  url: string,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const result = await request<T>('DELETE', url, undefined, options);
  clearResourceCache(url);
  return result;
}

/** PATCH 请求 */
export async function patch<T>(
  url: string,
  data?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const result = await request<T>('PATCH', url, data, options);
  clearResourceCache(url);
  return result;
}
