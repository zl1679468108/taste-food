import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { assertMemoryFallbackAllowed } from '../common/utils/memory-guard';

let supabaseInstance: SupabaseClient | null = null;
let supabaseHealthy = false;
let supabaseReady = false;
let initPromise: Promise<SupabaseClient | null> | null = null;
let consecutiveHealthFailures = 0;

// Export a live binding. A module-level const snapshot would remain null when
// callers import this module before the async health check completes.
export let supabase: SupabaseClient | null = null;

// 健康检查重连配置
const HEALTH_CHECK_INTERVAL_MS = 30_000; // 每 30 秒重新探测
const REINIT_AFTER_FAILURES = 2; // 连续失败 N 次后强制重建客户端
let healthCheckTimer: NodeJS.Timeout | null = null;

function shouldAllowMemoryFallback(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_MEMORY_FALLBACK === 'true';
}

function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/** 是否配置了 Supabase（与当前是否健康无关） */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

function formatErrorMessage(err: PostgrestError | unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: string }).message || err);
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function isConnectivityErrorMessage(msg: string): boolean {
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|network|certificate|SOCKS|proxy/i.test(
    msg,
  );
}

function proxyHint(msg: string): string {
  if (!isConnectivityErrorMessage(msg)) return '';
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (proxy) {
    return ` 已检测到代理 ${proxy}，请确认 Node 以 --use-env-proxy 启动（npm start 已默认开启）。`;
  }
  return ' 本机 DNS 可能无法解析 supabase.co，可配置 HTTPS_PROXY 或修复 DNS。';
}

function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function probeClient(client: SupabaseClient): Promise<void> {
  const result = await Promise.resolve(
    client.from('tf_shops').select('id', { count: 'exact', head: true }).limit(1),
  );
  const error = (result as { error?: PostgrestError | null } | null)?.error;
  if (error) {
    throw error;
  }
}

/**
 * 初始化 Supabase 客户端并执行健康检查。
 * 使用 Promise 缓存避免并发初始化，确保竞态安全。
 * 失败时根据环境决定是否回退到内存模式。
 */
function initializeSupabase(): Promise<SupabaseClient | null> {
  const config = getSupabaseConfig();

  if (!config) {
    assertMemoryFallbackAllowed('SUPABASE_URL 或 SUPABASE_KEY 未配置');
    console.warn('[Supabase] SUPABASE_URL 或 SUPABASE_KEY 未配置，使用内存模式。');
    return Promise.resolve(null);
  }

  const client = createSupabaseClient(config.url, config.key);

  // 执行健康检查（supabase-js 查询失败时通常返回 { error } 而不 reject）
  return probeClient(client)
    .then(() => {
      supabaseInstance = client;
      supabase = client;
      supabaseHealthy = true;
      supabaseReady = true;
      consecutiveHealthFailures = 0;
      console.log('[Supabase] 连接成功，使用 Supabase 模式。');
      scheduleHealthCheck();
      return client;
    })
    .catch((err: PostgrestError | unknown) => {
      supabaseHealthy = false;
      supabaseReady = false;
      const msg = formatErrorMessage(err);
      assertMemoryFallbackAllowed(`连接失败: ${msg}`);
      console.warn(
        `[Supabase] 连接失败: ${msg}，回退到内存模式。${proxyHint(msg)}`,
      );
      // 不保留失效实例；后续调用会重新尝试初始化
      supabaseInstance = null;
      supabase = null;
      return null;
    });
}

/**
 * 获取 Supabase 客户端（同步版本，用于已初始化后的快速访问）。
 * 在初始化完成前返回 null，调用方应结合 hasSupabase() 判断。
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!initPromise) {
    initPromise = initializeSupabase();
  }
  return supabaseInstance;
}

/**
 * 异步获取 Supabase 客户端，等待健康检查完成。
 * 应用启动时应调用此方法确保连接就绪。
 */
export async function getSupabaseClientAsync(): Promise<SupabaseClient | null> {
  if (!initPromise) {
    initPromise = initializeSupabase();
  }
  return initPromise;
}

/**
 * 强制重新初始化（健康检查连续失败或手动恢复时使用）。
 */
export async function reconnectSupabase(): Promise<SupabaseClient | null> {
  initPromise = initializeSupabase();
  return initPromise;
}

export function hasSupabase(): boolean {
  return supabaseInstance !== null && supabaseHealthy && supabaseReady;
}

export function isMemoryFallbackAllowed(): boolean {
  return shouldAllowMemoryFallback();
}

/** 当前错误是否像网络/DNS/代理连通性问题（而非业务查询失败） */
export function isSupabaseConnectivityError(err: unknown): boolean {
  return isConnectivityErrorMessage(formatErrorMessage(err));
}

// 暴露 ready 状态供外部等待
export function isSupabaseReady(): boolean {
  return supabaseReady;
}

/**
 * 定期健康检查，连接中断后自动尝试重连。
 */
function scheduleHealthCheck(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }
  healthCheckTimer = setInterval(async () => {
    // 实例被清空时走完整重连
    if (!supabaseInstance) {
      try {
        await reconnectSupabase();
      } catch {
        // reconnect 内部已打日志
      }
      return;
    }

    try {
      await probeClient(supabaseInstance);
      supabaseHealthy = true;
      supabaseReady = true;
      supabase = supabaseInstance;
      consecutiveHealthFailures = 0;
    } catch (err) {
      consecutiveHealthFailures += 1;
      const msg = formatErrorMessage(err);
      console.warn(
        `[Supabase] 健康检查失败(${consecutiveHealthFailures}): ${msg}${proxyHint(msg)}`,
      );
      supabaseHealthy = false;
      supabaseReady = false;
      supabase = null;

      // 连续失败后强制重建，避免坏连接一直占着
      if (consecutiveHealthFailures >= REINIT_AFTER_FAILURES) {
        supabaseInstance = null;
        initPromise = null;
        try {
          await reconnectSupabase();
        } catch {
          // ignore
        }
      }
    }
  }, HEALTH_CHECK_INTERVAL_MS);
  // 不阻止进程退出
  if (healthCheckTimer.unref) {
    healthCheckTimer.unref();
  }
}
