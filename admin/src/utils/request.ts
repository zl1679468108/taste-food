import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { antdMessage as message } from '@/utils/antdApp';
import { buildMutationKey, runExclusiveMutation } from './mutation-guard';

// ==================== 熔断器（Circuit Breaker）====================
// 连续 N 个 5xx 错误后阻断后续请求，避免服务端过载时客户端雪崩式重试。

interface CircuitBreakerState {
  /** 连续失败计数 */
  consecutiveFailures: number;
  /** 触发熔断的连续失败阈值 */
  threshold: number;
  /** 熔断开启后的冷却时间（ms） */
  cooldownMs: number;
  /** 熔断打开的时间戳（0 = 关闭） */
  openedAt: number;
  /** 是否处于半开状态（允许一次探测请求） */
  halfOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  consecutiveFailures: 0,
  threshold: 3,
  cooldownMs: 30_000, // 30 秒冷却
  openedAt: 0,
  halfOpen: false,
};

/** 判断 HTTP 状态码或业务码是否属于服务端错误（5xx） */
function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}

/** 检查熔断器是否已打开，若打开则返回错误信息 */
function checkCircuitOpen(): string | null {
  const now = Date.now();
  // 已经过冷却期 → 进入半开状态，允许一次探测
  if (circuitBreaker.openedAt > 0 && now - circuitBreaker.openedAt >= circuitBreaker.cooldownMs) {
    circuitBreaker.halfOpen = true;
    return null; // 允许通过，作为探测请求
  }
  // 熔断中且未到冷却时间
  if (circuitBreaker.openedAt > 0 && !circuitBreaker.halfOpen) {
    const remaining = Math.ceil((circuitBreaker.cooldownMs - (now - circuitBreaker.openedAt)) / 1000);
    return `服务暂时不可用，将在 ${remaining}秒 后自动恢复`;
  }
  return null;
}

/** 记录一次请求成功 → 重置/关闭熔断器 */
function recordSuccess(): void {
  if (circuitBreaker.halfOpen) {
    // 半开探测成功 → 完全恢复
    circuitBreaker.consecutiveFailures = 0;
    circuitBreaker.openedAt = 0;
    circuitBreaker.halfOpen = false;
  } else {
    circuitBreaker.consecutiveFailures = 0;
  }
}

/** 记录一次服务端失败 → 可能触发熔断 */
function recordFailure(): void {
  circuitBreaker.consecutiveFailures += 1;
  if (circuitBreaker.halfOpen) {
    // 半开探测失败 → 重新打开熔断，重新计时
    circuitBreaker.openedAt = Date.now();
    circuitBreaker.halfOpen = false;
    return;
  }
  if (circuitBreaker.consecutiveFailures >= circuitBreaker.threshold) {
    circuitBreaker.openedAt = Date.now();
    circuitBreaker.halfOpen = false;
    message.warning('服务端异常频繁，请求已暂停，稍后将自动恢复');
  }
}

/** 获取熔断器当前状态（供调试/外部查询） */
export function getCircuitBreakerState() {
  const now = Date.now();
  const isOpen = circuitBreaker.openedAt > 0 &&
    now - circuitBreaker.openedAt < circuitBreaker.cooldownMs;
  return {
    isOpen,
    isHalfOpen: circuitBreaker.halfOpen,
    consecutiveFailures: circuitBreaker.consecutiveFailures,
    threshold: circuitBreaker.threshold,
    openedAt: circuitBreaker.openedAt ? new Date(circuitBreaker.openedAt).toISOString() : null,
  };
}

/** 手动重置熔断器（用于调试或用户主动刷新） */
export function resetCircuitBreaker(): void {
  circuitBreaker.consecutiveFailures = 0;
  circuitBreaker.openedAt = 0;
  circuitBreaker.halfOpen = false;
}

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

/** 检查错误是否标记为静默（如熔断器拦截），静默错误禁止任何环节再 toast */
export function isSilentError(error: unknown): boolean {
  return !!(error && typeof error === 'object' && (error as { __tfSilent?: boolean }).__tfSilent);
}

/** 全局仅 toast 一次；skipErrorMessage 或 silent 错误时静默 */
function toastErrorOnce(config: AxiosRequestConfig | undefined, content: string, error?: unknown): void {
  if (shouldSkipErrorMessage(config)) return;
  if (error && isSilentError(error)) return;
  const text = (content || '').trim() || '请求失败';
  message.error(text);
}

/**
 * 创建一个已处理的业务错误。
 * @param msg 错误消息
 * @param cause 原始错误/数据
 * @param options.silent=true 时标记为完全静默（如熔断器拦截），禁止任何环节再 toast
 */
function createHandledError(
  msg: string,
  cause?: unknown,
  options?: { silent?: boolean },
): Error {
  const err = new Error(msg || '请求失败');
  // 标记已由拦截器提示，页面不应再 toast
  (err as Error & { __tfErrorHandled?: boolean; cause?: unknown }).__tfErrorHandled = true;
  if (cause !== undefined) {
    (err as Error & { cause?: unknown }).cause = cause;
  }
  // silent 标记：熔断器拦截等场景——已由上层统一提示过，所有环节禁止再 toast
  if (options?.silent) {
    (err as Error & { __tfSilent?: boolean }).__tfSilent = true;
  }
  return err;
}

function clearAuthAndRedirect(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  stopTokenRefreshLoop();
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
  // 熔断检查：服务端连续异常时直接拒绝请求（静默，因首次打开时已 warning 过）
  const blockMsg = checkCircuitOpen();
  if (blockMsg) {
    return Promise.reject(createHandledError(blockMsg, { circuitOpen: true }, { silent: true }));
  }

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

/**
 * 刷新失败类型：
 * - fatal=true  → refresh token 本身已失效（如后端明确 401 真过期），必须清登录态重新登录
 * - fatal=false → 认证服务暂不可用（503 / 网络错误 / 超时），保留登录态稍后重试，绝不直接踢出
 */
export class RefreshError extends Error {
  fatal: boolean;
  constructor(message: string, fatal: boolean) {
    super(message);
    this.name = 'RefreshError';
    this.fatal = fatal;
  }
}

/** 主动刷新循环间隔：15 分钟（远小于 ACCESS_TTL 2h），保证 token 常驻新鲜、避免被动 401 */
const REFRESH_LOOP_INTERVAL_MS = 15 * 60 * 1000;
let refreshLoopTimer: ReturnType<typeof setInterval> | null = null;
let refreshLoopActive = false;

async function doRefresh(allowRetry = true): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new RefreshError('no refresh token', true);
  }
  refreshPromise = (async () => {
    let lastErr: RefreshError | null = null;
    const maxAttempts = allowRetry ? 2 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // 裸 axios 绕过自身拦截器，避免 401 循环；带超时避免无限挂起
        const resp = await axios.post(
          '/api/auth/refresh',
          { refreshToken },
          { timeout: 10000 },
        );
        const body = resp.data;
        if (body && body.code === 0 && body.data && body.data.token) {
          const { token: newToken, refreshToken: newRefresh } = body.data;
          localStorage.setItem('token', newToken);
          if (newRefresh) localStorage.setItem('refreshToken', newRefresh);
          return newToken as string;
        }
        // 2xx 但业务码异常：视作刷新失败（理论上后端不会如此，保险处理）
        lastErr = new RefreshError('refresh returned unexpected body', true);
        break;
      } catch (e) {
        const err = e as AxiosError;
        const status = err?.response?.status;
        const code = err?.code;
        if (status === 401) {
          // refresh token 真过期/无效：必须重新登录
          lastErr = new RefreshError('refresh token expired', true);
          break;
        }
        // 503 / 超时 / 网络断开：认证服务暂不可用，保留登录态稍后重试
        const unavailable =
          status === 503 || code === 'ECONNABORTED' || status === 0 || !status;
        if (unavailable) {
          lastErr = new RefreshError('auth service unavailable', false);
          if (attempt < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
        } else {
          lastErr = new RefreshError('refresh network error', false);
          break;
        }
      }
    }
    throw lastErr!;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/** 用 refresh 换发新 access，并用新 token 重放原始请求（并发 401 时只刷新一次） */
async function tryRefreshAndRetry(originalRequest: AxiosRequestConfig): Promise<any> {
  const newToken = await doRefresh(true);
  const retryReq: AxiosRequestConfig & { _isRefreshRetry?: boolean } = {
    ...originalRequest,
    _isRefreshRetry: true,
  };
  retryReq.headers = {
    ...(retryReq.headers || {}),
    Authorization: `Bearer ${newToken}`,
  };
  return request(retryReq);
}

/** 启动主动刷新循环：登录后调用，定时刷新 access，实现真正的无感刷新 */
export function ensureTokenRefreshLoop(): void {
  if (refreshLoopActive) return;
  if (!localStorage.getItem('refreshToken')) return;
  refreshLoopActive = true;
  refreshLoopTimer = setInterval(() => {
    if (!localStorage.getItem('refreshToken')) {
      stopTokenRefreshLoop();
      return;
    }
    // 失败（非 fatal 服务暂不可用）静默，下一轮循环再试；fatal 才清登录态
    doRefresh(false).catch((e) => {
      if (e instanceof RefreshError && e.fatal) {
        clearAuthAndRedirect();
      }
    });
  }, REFRESH_LOOP_INTERVAL_MS);
}

/** 停止主动刷新循环（登出 / 登录态失效时调用） */
export function stopTokenRefreshLoop(): void {
  refreshLoopActive = false;
  if (refreshLoopTimer) {
    clearInterval(refreshLoopTimer);
    refreshLoopTimer = null;
  }
}

request.interceptors.response.use(
  async (response) => {
    // 熔断：请求成功 → 重置计数（半开状态下完全恢复）
    recordSuccess();

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
      // 熔断：业务码 5xx 也计入服务端失败
      if (typeof data.code === 'number' && isServerError(data.code)) {
        recordFailure();
        const blockMsg = checkCircuitOpen();
        if (blockMsg) {
          return Promise.reject(createHandledError(blockMsg, data, { silent: true }));
        }
      }

      // 后端 UNAUTHORIZED 业务码 1004 可能伴随 HTTP 200；按 401 走 refresh 重试
      const originalRequest = config as AxiosRequestConfig & {
        _isRefreshRetry?: boolean;
        skipErrorMessage?: boolean;
      };
      const isAuthEndpoint =
        originalRequest?.url?.includes('/api/auth/refresh') ||
        originalRequest?.url?.includes('/api/auth/wechat-login') ||
        originalRequest?.url?.includes('/api/auth/login');
      if (
        (data.code === 1004 || data.code === 401) &&
        originalRequest &&
        !originalRequest._isRefreshRetry &&
        !isAuthEndpoint
      ) {
        try {
          return await tryRefreshAndRetry(originalRequest);
        } catch (e) {
          // refresh 因「真过期」失败才清登录态；服务暂不可用则保留登录态、提示稍后重试
          if (e instanceof RefreshError && e.fatal) {
            clearAuthAndRedirect();
            toastErrorOnce(originalRequest, '登录已过期，请重新登录', e);
          } else {
            toastErrorOnce(originalRequest, '认证服务暂时不可用，请稍后重试', e);
          }
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
      originalRequest?.url?.includes('/api/auth/wechat-login') ||
      originalRequest?.url?.includes('/api/auth/login');

    // 熔断：记录 5xx 服务端错误（401/403/404 不计入，避免误触发）
    const errorStatus = error.response?.status;
    if (errorStatus && isServerError(errorStatus)) {
      recordFailure();
      // 熔断已打开 → 直接拒绝，不再重试 refresh 等（静默）
      const blockMsg = checkCircuitOpen();
      if (blockMsg) {
        return Promise.reject(createHandledError(blockMsg, error, { silent: true }));
      }
    }

    // 503（认证服务暂不可用）：也尝试 refresh 恢复（后端内存兜底可能成功），失败保留登录态
    if (
      error.response?.status === 503 &&
      originalRequest &&
      !originalRequest._isRefreshRetry &&
      !isAuthEndpoint
    ) {
      try {
        return await tryRefreshAndRetry(originalRequest);
      } catch (e) {
        if (e instanceof RefreshError && e.fatal) {
          clearAuthAndRedirect();
          toastErrorOnce(originalRequest, '登录已过期，请重新登录', e);
        } else {
          toastErrorOnce(originalRequest, '认证服务暂时不可用，请稍后重试', e);
        }
        return Promise.reject(createHandledError('请求失败，请稍后重试', e));
      }
    }

    // 401：尝试 refresh 后重试一次，失败再清除登录态
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._isRefreshRetry &&
      !isAuthEndpoint
    ) {
      try {
        return await tryRefreshAndRetry(originalRequest);
      } catch (e) {
        // refresh 因「真过期」失败才清登录态；服务暂不可用则保留登录态、提示稍后重试
        if (e instanceof RefreshError && e.fatal) {
          clearAuthAndRedirect();
          toastErrorOnce(originalRequest, '登录已过期，请重新登录', e);
        } else {
          toastErrorOnce(originalRequest, '认证服务暂时不可用，请稍后重试', e);
        }
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
    toastErrorOnce(originalRequest, msg, error);
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
