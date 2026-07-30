import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { message } from 'antd';
import { buildMutationKey, runExclusiveMutation } from './mutation-guard';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * 统一请求错误约定（避免图5 双 toast）：
 * 1. 业务 code !== 0 与 HTTP/网络错误，均由本拦截器 toast 一次
 * 2. 页面 catch 中只做本地状态回退（loading/modal），不要再 message.error
 * 3. 特殊场景传 { skipErrorMessage: true } 可跳过全局 toast
 * 4. reject 的 Error.message 仍可读，供日志或自定义文案（但不建议再 toast）
 * 5. 401 会先尝试 refresh；refresh 失败仅 toast「登录已过期」一次
 */
export interface RequestConfig extends AxiosRequestConfig {
  /** 显式启用 GET 缓存（默认不缓存，管理后台需实时数据） */
  useCache?: boolean;
  cachedData?: unknown;
  /** 内部标记：本次请求为 refresh 重试，避免循环 */
  _isRefreshRetry?: boolean;
  /**
   * 跳过全局错误 toast。
   * 适用于：静默轮询、自定义错误 UI、批量请求自行汇总提示。
   * 注意：401 登录过期提示也会被跳过（仍会清登录态并跳转）。
   */
  skipErrorMessage?: boolean;
  /**
   * 跳过写操作全局去重（默认 POST/PUT/PATCH/DELETE 同 method+url+body 互斥）。
   * 仅用于确实需要并发重复提交的场景。
   */
  skipDuplicateGuard?: boolean;
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
  // 返回深拷贝避免调用方修改污染缓存
  if (entry.data && typeof entry.data === 'object') {
    try {
      return JSON.parse(JSON.stringify(entry.data)) as T;
    } catch {
      return entry.data as T;
    }
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
  const params = config.params
    ? JSON.stringify(
        Object.keys(config.params)
          .sort()
          .reduce(
            (acc, key) => {
              acc[key] = config.params[key];
              return acc;
            },
            {} as Record<string, unknown>,
          ),
      )
    : '';
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
  if (error instanceof Error && error.message) return error.message;
  return String(error || '网络错误');
}

function extractResponseMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const maybe = data as { message?: unknown; msg?: unknown; error?: unknown };
    if (typeof maybe.message === 'string' && maybe.message) return maybe.message;
    if (typeof maybe.msg === 'string' && maybe.msg) return maybe.msg;
    if (typeof maybe.error === 'string' && maybe.error) return maybe.error;
  }
  return fallback;
}

function shouldSkipErrorMessage(config?: AxiosRequestConfig): boolean {
  return Boolean((config as RequestConfig | undefined)?.skipErrorMessage);
}

/** 全局仅 toast 一次；skipErrorMessage 时静默 */
function toastErrorOnce(config: AxiosRequestConfig | undefined, content: string): void {
  if (shouldSkipErrorMessage(config)) return;
  const text = (content || '').trim() || '请求失败';
  message.error(text);
}

function createHandledError(msg: string, cause?: unknown): Error {
  const err = new Error(msg || '请求失败');
  // 标记已由拦截器提示，页面不应再 toast
  (err as Error & { __tfErrorHandled?: boolean; cause?: unknown }).__tfErrorHandled = true;
  if (cause !== undefined) {
    (err as Error & { cause?: unknown }).cause = cause;
  }
  return err;
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

// 扩展 AxiosRequestConfig 以支持 useCache / skipErrorMessage
declare module 'axios' {
  interface AxiosRequestConfig {
    /** 显式启用 GET 缓存（默认不缓存，管理后台需实时数据） */
    useCache?: boolean;
    cachedData?: unknown;
    /** 内部标记：本次请求为 refresh 重试，避免循环 */
    _isRefreshRetry?: boolean;
    /**
     * 跳过全局错误 toast（业务 code / HTTP 均跳过）。
     * 页面 catch 中也不要再 toast，除非自行实现完整错误 UI。
     */
    skipErrorMessage?: boolean;
    /**
     * 跳过写操作全局去重（默认 POST/PUT/PATCH/DELETE 同 method+url+body 互斥）。
     * 仅用于确实需要并发重复提交的场景。
     */
    skipDuplicateGuard?: boolean;
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
  async (response) => {
    const { data, config } = response;

    // 命中缓存时直接返回缓存数据
    if (config.cachedData) {
      return config.cachedData;
    }

    // 非标准业务包（如 blob / 纯文本）直接透传
    if (data == null || typeof data !== 'object' || Array.isArray(data) || !('code' in data)) {
      return data;
    }

    if (data.code !== 0) {
      // 后端 UNAUTHORIZED 业务码 1004 可能伴随 HTTP 200；按 401 走 refresh 重试
      const originalRequest = config as AxiosRequestConfig & {
        _isRefreshRetry?: boolean;
        skipErrorMessage?: boolean;
      };
      const isAuthEndpoint =
        originalRequest?.url?.includes('/api/auth/refresh') ||
        originalRequest?.url?.includes('/api/auth/wechat-login') ||
        originalRequest?.url?.includes('/api/auth/password-login');
      if (
        (data.code === 1004 || data.code === 401) &&
        originalRequest &&
        !originalRequest._isRefreshRetry &&
        !isAuthEndpoint
      ) {
        try {
          const newToken = await doRefresh();
          originalRequest._isRefreshRetry = true;
          originalRequest.headers = originalRequest.headers || {};
          (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
          return request(originalRequest);
        } catch (e) {
          clearAuthAndRedirect();
          toastErrorOnce(originalRequest, '登录已过期，请重新登录');
          return Promise.reject(createHandledError('登录已过期，请重新登录', e));
        }
      }

      if ((data.code === 1004 || data.code === 401) && (originalRequest?._isRefreshRetry || isAuthEndpoint)) {
        clearAuthAndRedirect();
        return Promise.reject(createHandledError('登录已过期，请重新登录', data));
      }

      const msg = extractResponseMessage(data, '请求失败');
      // 业务失败：全局 toast 一次，页面 catch 不要再 toast
      toastErrorOnce(config, msg);
      return Promise.reject(createHandledError(msg, data));
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
    const originalRequest = error.config as
      | (AxiosRequestConfig & { _isRefreshRetry?: boolean; skipErrorMessage?: boolean })
      | undefined;
    const isAuthEndpoint =
      originalRequest?.url?.includes('/api/auth/refresh') ||
      originalRequest?.url?.includes('/api/auth/wechat-login');

    // 401：尝试 refresh 后重试一次，失败再清除登录态
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._isRefreshRetry &&
      !isAuthEndpoint
    ) {
      try {
        const newToken = await doRefresh();
        originalRequest._isRefreshRetry = true;
        originalRequest.headers = originalRequest.headers || {};
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return request(originalRequest);
      } catch (e) {
        // refresh 失败：清登录态 + 弹一次提示即可，避免下方分支再次 message
        clearAuthAndRedirect();
        toastErrorOnce(originalRequest, '登录已过期，请重新登录');
        return Promise.reject(createHandledError('登录已过期，请重新登录', e));
      }
    }

    // refresh 后重试仍 401，或 auth 接口 401：清登录态（不再弹 message，避免与 refresh catch 重复）
    if (error.response?.status === 401 && (originalRequest?._isRefreshRetry || isAuthEndpoint)) {
      clearAuthAndRedirect();
      return Promise.reject(createHandledError('登录已过期，请重新登录', error));
    }

    // 其他非 401 错误：HTTP / 网络，统一 toast 一次
    const respData = error.response?.data;
    const fallback =
      error.response?.status === 403
        ? '无权限访问'
        : error.response?.status === 404
          ? '资源不存在'
          : error.response?.status === 500
            ? '服务器错误'
            : error.message || '网络错误';
    const msg = extractResponseMessage(respData, fallback);
    toastErrorOnce(originalRequest, msg);
    return Promise.reject(createHandledError(msg, error));
  },
);

/**
 * 写操作全局去重：同 method + url + body 进行中时直接拒绝，
 * 防止连点 / 重复提交造成重复下单、重复审批、重复状态流转。
 *
 * 说明：
 * - FormData / Blob 等非普通对象 body 无法稳定序列化，跳过去重（由上传组件自身管控）
 * - 需要并发重复调用同一接口时传 { skipDuplicateGuard: true }
 */
function isPlainBody(data: unknown): data is Record<string, unknown> {
  if (data == null) return true;
  if (typeof data !== 'object') return false;
  if (Array.isArray(data)) return true;
  return Object.getPrototypeOf(data) === Object.prototype;
}

type MutationMethod = 'post' | 'put' | 'patch' | 'delete';

function guardMutation<T>(
  method: MutationMethod,
  url: string,
  data: unknown,
  config: RequestConfig | undefined,
  send: () => Promise<T>,
): Promise<T> {
  if (config?.skipDuplicateGuard || !isPlainBody(data)) {
    return send();
  }
  const key = buildMutationKey(method, url, data as Record<string, unknown> | undefined);
  return runExclusiveMutation(key, send);
}

const rawPost = request.post.bind(request);
const rawPut = request.put.bind(request);
const rawPatch = request.patch.bind(request);
const rawDelete = request.delete.bind(request);

request.post = ((url: string, data?: unknown, config?: RequestConfig) =>
  guardMutation('post', url, data, config, () =>
    rawPost(url, data, config),
  )) as typeof request.post;

request.put = ((url: string, data?: unknown, config?: RequestConfig) =>
  guardMutation('put', url, data, config, () =>
    rawPut(url, data, config),
  )) as typeof request.put;

request.patch = ((url: string, data?: unknown, config?: RequestConfig) =>
  guardMutation('patch', url, data, config, () =>
    rawPatch(url, data, config),
  )) as typeof request.patch;

request.delete = ((url: string, config?: RequestConfig) =>
  guardMutation('delete', url, undefined, config, () =>
    rawDelete(url, config),
  )) as typeof request.delete;

export function isRequestErrorHandled(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      (error as { __tfErrorHandled?: boolean }).__tfErrorHandled,
  );
}

export { clearCache, createHandledError };
export { DuplicateSubmitError, isDuplicateSubmitError } from './mutation-guard';
export default request;
