import Taro from '@tarojs/taro';
import { API_BASE_URL } from '../env';
import { ApiResponse } from '../types/api';

/** 请求方法类型 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** 请求选项 */
interface RequestOptions {
  /** 请求头 */
  headers?: Record<string, string>;
  /** 超时时间 (ms) */
  timeout?: number;
  /** 是否显示错误提示（默认 true） */
  showError?: boolean;
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
 * 统一请求处理
 */
async function request<T>(
  method: HttpMethod,
  url: string,
  data?: Record<string, any>,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 构建完整 URL
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  try {
    const response = await Taro.request({
      url: fullUrl,
      method,
      data,
      header: headers,
      timeout: options?.timeout || 10000,
    });

    const responseData = response.data as ApiResponse<T>;

    // 统一错误处理
    if (responseData.code !== 0) {
      // 401 - 未认证，跳转登录页
      if (responseData.code === 401) {
        Taro.removeStorageSync('token');
        Taro.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
        setTimeout(() => {
          Taro.navigateTo({ url: '/pages/auth/login' });
        }, 1500);
      }

      if (options?.showError !== false && responseData.message) {
        Taro.showToast({ title: responseData.message, icon: 'none' });
      }

      throw new RequestError(responseData.message || '请求失败', responseData.code);
    }

    return responseData;
  } catch (error: any) {
    // 网络错误
    if (error.errno || error.message === 'Network request failed') {
      const errMsg = '网络连接失败，请检查网络';
      if (options?.showError !== false) {
        Taro.showToast({ title: errMsg, icon: 'none' });
      }
      throw new RequestError(errMsg, -1);
    }

    // 重新抛出已知错误
    if (error instanceof RequestError) {
      throw error;
    }

    // 未知错误
    throw new RequestError(error.message || '未知错误', -2);
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
  params?: Record<string, any>,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('GET', url, params, options);
}

/** POST 请求 */
export function post<T>(
  url: string,
  data?: Record<string, any>,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('POST', url, data, options);
}

/** PUT 请求 */
export function put<T>(
  url: string,
  data?: Record<string, any>,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('PUT', url, data, options);
}

/** DELETE 请求 */
export function del<T>(
  url: string,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('DELETE', url, undefined, options);
}

/** PATCH 请求 */
export function patch<T>(
  url: string,
  data?: Record<string, any>,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('PATCH', url, data, options);
}
