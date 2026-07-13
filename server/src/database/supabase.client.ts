import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let supabaseHealthy = false;
let supabaseReady = false;
let initPromise: Promise<SupabaseClient | null> | null = null;

// 健康检查重连配置
const HEALTH_CHECK_INTERVAL_MS = 30_000; // 每 30 秒重新探测
let healthCheckTimer: NodeJS.Timeout | null = null;

function shouldAllowMemoryFallback(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_MEMORY_FALLBACK === 'true';
}

function assertMemoryFallbackAllowed(reason: string): void {
  if (!shouldAllowMemoryFallback()) {
    throw new Error(`[Supabase] ${reason}，生产环境禁止回退到内存模式。`);
  }
}

/**
 * 初始化 Supabase 客户端并执行健康检查。
 * 使用 Promise 缓存避免并发初始化，确保竞态安全。
 * 失败时根据环境决定是否回退到内存模式。
 */
function initializeSupabase(): Promise<SupabaseClient | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    assertMemoryFallbackAllowed('SUPABASE_URL 或 SUPABASE_KEY 未配置');
    console.warn('[Supabase] SUPABASE_URL 或 SUPABASE_KEY 未配置，使用内存模式。');
    return Promise.resolve(null);
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 执行健康检查
  return Promise.resolve(
    client
      .from('tf_shops')
      .select('id', { count: 'exact', head: true })
      .limit(1),
  )
    .then(() => {
      supabaseInstance = client;
      supabaseHealthy = true;
      supabaseReady = true;
      console.log('[Supabase] 连接成功，使用 Supabase 模式。');
      scheduleHealthCheck();
      return client;
    })
    .catch((err: PostgrestError | unknown) => {
      supabaseHealthy = false;
      supabaseReady = false;
      const msg = err instanceof Error ? err.message : String(err);
      assertMemoryFallbackAllowed(`连接失败: ${msg}`);
      console.warn('[Supabase] 连接失败:', msg, '回退到内存模式。');
      // 不保留失效实例；后续调用会重新尝试初始化
      supabaseInstance = null;
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
 * 为了向后兼容保留模块级导出。
 * 注意：此值在模块加载时为 null，需调用 getSupabaseClientAsync() 等待就绪。
 */
export const supabase = getSupabaseClient();

export function hasSupabase(): boolean {
  return supabaseInstance !== null && supabaseHealthy && supabaseReady;
}

export function isMemoryFallbackAllowed(): boolean {
  return shouldAllowMemoryFallback();
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
    if (!supabaseInstance) return;
    try {
      await Promise.resolve(
        supabaseInstance
          .from('tf_shops')
          .select('id', { count: 'exact', head: true })
          .limit(1),
      );
      supabaseHealthy = true;
      supabaseReady = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Supabase] 健康检查失败:', msg);
      supabaseHealthy = false;
      supabaseReady = false;
      // 重置 initPromise 以便下次 getSupabaseClientAsync 触发重连
      initPromise = null;
    }
  }, HEALTH_CHECK_INTERVAL_MS);
  // 不阻止进程退出
  if (healthCheckTimer.unref) {
    healthCheckTimer.unref();
  }
}
