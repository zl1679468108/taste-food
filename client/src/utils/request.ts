import * as TaroImport from '@tarojs/taro';
import { API_BASE_URL } from '../env';
import { ApiResponse } from '../types/api';
import { getCache, setCache, clearResourceCache } from './cache';
import { buildMutationKey, runExclusiveMutation } from './mutation-guard';
import { useAuthStore } from '../stores/authStore';

const Taro = (TaroImport as typeof TaroImport & { default?: typeof TaroImport }).default || TaroImport;
const isTestEnv = process.env.NODE_ENV === 'test';

/**
 * 请求默认超时（ms）。
 * 之前硬编码 10000，下单等重接口在后端偶发抖动（地图 geocode 5s、购物车商品较多）
 * 时容易撞 10s 红线被 Taro 取消。放宽到 30s，仍在微信小程序 60s 上限内，留足余量。
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

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

/** 判断业务码是否属于服务端错误（5xx） */
function isServerErrorCode(code: number): boolean {
  return code >= 500 && code < 600;
}

/** 检查熔断器是否已打开，若打开则返回错误信息 */
function checkCircuitOpen(): string | null {
  const now = Date.now();
  if (circuitBreaker.openedAt > 0 && now - circuitBreaker.openedAt >= circuitBreaker.cooldownMs) {
    circuitBreaker.halfOpen = true;
    return null; // 允许通过，作为探测请求
  }
  if (circuitBreaker.openedAt > 0 && !circuitBreaker.halfOpen) {
    const remaining = Math.ceil((circuitBreaker.cooldownMs - (now - circuitBreaker.openedAt)) / 1000);
    return `服务暂时不可用，将在 ${remaining}秒 后自动恢复`;
  }
  return null;
}

/** 记录一次请求成功 → 重置/关闭熔断器 */
function recordSuccess(): void {
  if (circuitBreaker.halfOpen) {
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
    circuitBreaker.openedAt = Date.now();
    circuitBreaker.halfOpen = false;
    return;
  }
  if (circuitBreaker.consecutiveFailures >= circuitBreaker.threshold) {
    circuitBreaker.openedAt = Date.now();
    circuitBreaker.halfOpen = false;
    Taro.showToast({ title: '服务异常频繁，请求已暂停', icon: 'none', duration: 2000 });
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
  /**
   * 失败后额外重试次数（不含首次）。
   * 默认：网络类错误 1 次；业务错误 0 次。
   */
  retries?: number;
  /** 重试基础间隔 ms，实际为 delay * attempt，默认 800 */
  retryDelay?: number;
  /** 强制指定是否可重试（覆盖自动判断） */
  retryable?: boolean;
  /** 跳过全局 401 自动登出拦截（用于 /auth/refresh 等认证接口） */
  skipAuthRedirect?: boolean;
  /**
   * 跳过写操作全局去重（默认 POST/PUT/PATCH/DELETE 同 method+url+body 互斥）。
   * 仅用于确实需要并发重复提交的场景（如批量循环调用同一接口）。
   */
  skipDuplicateGuard?: boolean;
}

const RETRYABLE_BUSINESS_CODES = new Set([500, 502, 503, 504, -1, -2]);

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
  const sortedParams = data
    ? JSON.stringify(
        Object.keys(data)
          .sort()
          .reduce((acc, key) => {
            acc[key] = data[key];
            return acc;
          }, {} as RequestData),
      )
    : '';
  return `${method}:${url}:${sortedParams}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '未知错误');
}

/** 归一化后端 message（兼容 string / string[] / 空值） */
function normalizeErrorMessage(message: unknown, fallback = '请求失败'): string {
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const joined = message.filter((item) => typeof item === 'string' && item.trim()).join('; ');
    if (joined) return joined;
  }
  return fallback;
}

function showErrorToast(message: string) {
  Taro.showToast({ title: message, icon: 'none' });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 读取网络类型：wifi/2g/3g/4g/5g/none/unknown */
async function getNetworkTypeSafe(): Promise<string> {
  try {
    const api = (Taro as { getNetworkType?: () => Promise<{ networkType?: string }> }).getNetworkType;
    if (typeof api === 'function') {
      const res = await api.call(Taro);
      return (res?.networkType || 'unknown').toLowerCase();
    }
  } catch {
    // ignore
  }
  return 'unknown';
}

function isNetworkLikeError(error: unknown): boolean {
  if (error instanceof RequestError) {
    return error.isNetworkError || error.code === -1;
  }
  const err = error as { errno?: number; errMsg?: string; message?: string };
  if (err?.errno) return true;
  const msg = `${err?.errMsg || ''} ${err?.message || ''}`.toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('fail') ||
    msg.includes('request:fail')
  );
}

/** 后端 UNAUTHORIZED 业务码（与 HTTP 401 分离，见 server BizErrorCode） */
const UNAUTHORIZED_BIZ_CODE = 1004;

/** 判断是否未认证：兼容历史 code=401 与当前业务码 1004 */
export function isUnauthorizedCode(code: unknown): boolean {
  return code === 401 || code === UNAUTHORIZED_BIZ_CODE;
}

function shouldRetry(error: unknown, options?: RequestOptions): boolean {
  if (typeof options?.retryable === 'boolean') {
    return options.retryable;
  }
  if (error instanceof RequestError) {
    if (
      isUnauthorizedCode(error.code) ||
      error.code === 400 ||
      error.code === 403 ||
      error.code === 404
    ) {
      return false;
    }
    return error.retryable || RETRYABLE_BUSINESS_CODES.has(error.code);
  }
  return isNetworkLikeError(error);
}

/**
 * 统一请求处理（含弱网 toast + 可重试错误自动重试）。
 * - 弱网（2g/3g）：首败时 toast「当前网络较慢…」
 * - 网络失败：默认额外重试 1 次；业务 5xx 也可重试
 * - /orders GET 默认禁缓存（见 shouldUseGetCache）
 * - 页面级「点击重试」请用导出的 isRetryableError()
 */
function shouldUseGetCache(url: string, options?: RequestOptions): boolean {
  // 订单相关 GET 默认禁用缓存，避免列表/详情/后台状态刷新拿到旧数据
  // 注意：评价接口 /orders/:id/reviews 也落在 /orders 路径下，同样不缓存
  if (options?.useCache === true) return true;
  if (options?.useCache === false) return false;
  if (url.includes('/orders')) return false;
  return true;
}

async function request<T>(
  method: HttpMethod,
  url: string,
  data?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  // 熔断检查：服务端连续异常时直接拒绝请求
  const blockMsg = checkCircuitOpen();
  if (blockMsg) {
    throw new RequestError(blockMsg, -3, { retryable: false, isNetworkError: false });
  }

  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const cacheKey = options?.cacheKey || buildCacheKey(method, fullUrl, data);

  if (method === 'GET' && shouldUseGetCache(url, options)) {
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

  // 默认：GET 网络类错误重试 1 次；显式 retries 覆盖
  // 写操作默认不重试：超时/弱网下服务端可能已落库，重试会造成重复下单、重复状态流转
  const defaultRetries =
    typeof options?.retries === 'number' ? options.retries : method === 'GET' ? 1 : 0;
  const retryDelay = options?.retryDelay ?? 800;

  let attempt = 0;
  let weakNetWarned = false;
  let tokenRefreshed = false;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const networkType = await getNetworkTypeSafe();
      if (networkType === 'none') {
        throw new RequestError('网络不可用，请检查网络连接', -1, {
          retryable: true,
          isNetworkError: true,
        });
      }
      if (
        (networkType === '2g' || networkType === '3g') &&
        options?.showError !== false &&
        !weakNetWarned
      ) {
        weakNetWarned = true;
        Taro.showToast({ title: '当前网络较弱，加载可能较慢', icon: 'none' });
      }

      const response = await Taro.request({
        url: fullUrl,
        method,
        data,
        header: headers,
        timeout: options?.timeout || DEFAULT_REQUEST_TIMEOUT_MS,
      });

      const rawData = response.data;
      const responseData = (
        rawData && typeof rawData === 'object' ? rawData : { code: -2, data: null, message: '服务响应异常' }
      ) as ApiResponse<T>;

      if (responseData.code !== 0) {
        // 熔断：业务码 5xx 记录为服务端失败
        if (isServerErrorCode(responseData.code)) {
          recordFailure();
          const blockMsg = checkCircuitOpen();
          if (blockMsg) {
            throw new RequestError(blockMsg, responseData.code, {
              retryable: false,
              isNetworkError: false,
            });
          }
        }

        const errorMessage = normalizeErrorMessage(responseData.message);
        let sessionErrorToasted = false;

        // 仅当「本次请求带着 token」时，才把 1004/401 当会话过期去刷新。
        // 登录/注册等无 token 场景也会返回 1004（如用户名密码错误），必须走普通业务错误 toast。
        const hadToken = Boolean(token);
        if (hadToken && isUnauthorizedCode(responseData.code) && !options?.skipAuthRedirect) {
          // access token 过期：先尝试用 refreshToken 换新 token，再重试原请求
          // 注意：后端业务码是 1004（UNAUTHORIZED），不是 HTTP 语义的 401
          if (!tokenRefreshed) {
            tokenRefreshed = true;
            try {
              await useAuthStore.getState().refreshSession();
              // refreshSession 成功后 store 里已更新，从 storage 取最新 token
              const newToken = getToken();
              if (newToken) {
                headers['Authorization'] = `Bearer ${newToken}`;
                // 重新发起原请求（不计入 attempt 重试计数）
                continue;
              }
            } catch {
              // refreshSession 内部会在 refreshToken 过期时自行 logout，这里仅 fallthrough
            }
          }

          const pages = Taro.getCurrentPages();
          const currentPage = pages[pages.length - 1];
          const isLoginPage = currentPage?.route === 'pages/auth/login';
          const sessionMessage = normalizeErrorMessage(
            responseData.message,
            '登录已过期，请重新登录',
          );

          // 若 storage token 已被清空，说明 refreshSession 内部已经 logout
          if (!getToken()) {
            if (options?.showError !== false) {
              showErrorToast(isLoginPage ? sessionMessage : '登录已过期，请重新登录');
            }
            throw new RequestError(sessionMessage, responseData.code, {
              retryable: false,
              isNetworkError: false,
            });
          }

          // 刷新后 token 依然存在但再次未认证，走登出流程
          if (!isLoginPage) {
            if (options?.showError !== false) {
              showErrorToast('登录已过期，请重新登录');
              sessionErrorToasted = true;
            }
            if (!isTestEnv) {
              setTimeout(() => {
                useAuthStore.getState().logout();
              }, 1500);
            }
          } else {
            try {
              useAuthStore.getState().stopAutoRefresh();
            } catch {
              // ignore
            }
          }
        }

        const businessError = new RequestError(errorMessage, responseData.code, {
          retryable: RETRYABLE_BUSINESS_CODES.has(responseData.code),
          isNetworkError: false,
        });

        if (shouldRetry(businessError, options) && attempt < defaultRetries) {
          attempt += 1;
          await sleep(retryDelay * attempt);
          continue;
        }

        if (options?.showError !== false && !sessionErrorToasted) {
          showErrorToast(errorMessage);
        }

        throw businessError;
      }

      if (method === 'GET' && shouldUseGetCache(url, options)) {
        setCache(cacheKey, responseData);
      }

      // 熔断：请求成功 → 重置计数
      recordSuccess();

      return responseData;
    } catch (error: unknown) {
      if (error instanceof RequestError && !error.isNetworkError && error.code !== -1) {
        // 业务错误：上面已处理 toast / 重试，直接抛出
        if (!shouldRetry(error, options) || attempt >= defaultRetries) {
          throw error;
        }
        attempt += 1;
        await sleep(retryDelay * attempt);
        continue;
      }

      const networkError = new RequestError('网络连接失败，请检查网络', -1, {
        retryable: true,
        isNetworkError: true,
      });

      // 保留非网络的未知错误信息
      if (!isNetworkLikeError(error) && !(error instanceof RequestError)) {
        const unknownError = new RequestError(getErrorMessage(error), -2, {
          retryable: true,
          isNetworkError: false,
        });
        if (shouldRetry(unknownError, options) && attempt < defaultRetries) {
          attempt += 1;
          await sleep(retryDelay * attempt);
          continue;
        }
        if (options?.showError !== false) {
          showErrorToast(unknownError.message);
        }
        throw unknownError;
      }

      if (shouldRetry(networkError, options) && attempt < defaultRetries) {
        attempt += 1;
        await sleep(retryDelay * attempt);
        continue;
      }

      if (options?.showError !== false) {
        showErrorToast(networkError.message);
      }
      throw networkError;
    }
  }
}

/** 请求错误类 */
export class RequestError extends Error {
  code: number;
  retryable: boolean;
  isNetworkError: boolean;

  constructor(
    message: string,
    code: number,
    meta?: { retryable?: boolean; isNetworkError?: boolean },
  ) {
    super(message);
    this.name = 'RequestError';
    this.code = code;
    this.retryable = meta?.retryable ?? RETRYABLE_BUSINESS_CODES.has(code);
    this.isNetworkError = meta?.isNetworkError ?? code === -1;
  }
}

/**
 * 判断错误是否适合页面级「点击重试」。
 * 用法：catch 后若 isRetryableError(err) 则展示 EmptyState 重试按钮。
 * 网络错误 / 5xx / RequestError.retryable=true 返回 true；401/403/404 等业务错误返回 false。
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RequestError) {
    return error.retryable || error.isNetworkError;
  }
  return isNetworkLikeError(error);
}

/** GET 请求 */
export function get<T>(
  url: string,
  params?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return request<T>('GET', url, params, options);
}

/**
 * 写操作统一包装：
 * 1. 同 method + url + body 的请求在进行中时直接拒绝（DuplicateSubmitError），
 *    防止连点 / 事件重入造成重复下单、重复状态流转
 * 2. 成功后清理该资源的 GET 缓存
 */
function mutate<T>(
  method: Exclude<HttpMethod, 'GET'>,
  url: string,
  data?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const send = async (): Promise<ApiResponse<T>> => {
    const result = await request<T>(method, url, data, options);
    clearResourceCache(url);
    return result;
  };

  if (options?.skipDuplicateGuard) {
    return send();
  }

  return runExclusiveMutation(buildMutationKey(method, url, data), send);
}

/** POST 请求 */
export function post<T>(
  url: string,
  data?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return mutate<T>('POST', url, data, options);
}

/** PUT 请求 */
export function put<T>(
  url: string,
  data?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return mutate<T>('PUT', url, data, options);
}

/** DELETE 请求 */
export function del<T>(
  url: string,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return mutate<T>('DELETE', url, undefined, options);
}

/** PATCH 请求 */
export function patch<T>(
  url: string,
  data?: RequestData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  return mutate<T>('PATCH', url, data, options);
}

export {
  DuplicateSubmitError,
  isDuplicateSubmitError,
} from './mutation-guard';
