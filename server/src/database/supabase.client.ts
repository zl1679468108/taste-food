import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let supabaseHealthy = false;
let supabaseReady = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn(
        '[Supabase] SUPABASE_URL 或 SUPABASE_KEY 未配置，使用内存模式。',
      );
      return null;
    }

    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 健康检查
    const checkPromise = supabaseInstance
      .from('tf_shops')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    Promise.resolve(checkPromise).then(() => {
      supabaseHealthy = true;
      supabaseReady = true;
      console.log('[Supabase] 连接成功，使用 Supabase 模式。');
    }).catch((err: PostgrestError | unknown) => {
      supabaseHealthy = false;
      supabaseReady = false;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        '[Supabase] 连接失败:', msg, '回退到内存模式。',
      );
      supabaseInstance = null;
    });
  }

  return supabaseInstance;
}

export const supabase = getSupabaseClient();

export function hasSupabase(): boolean {
  return supabase !== null && supabaseHealthy && supabaseReady;
}

// 暴露 ready 状态供外部等待
export function isSupabaseReady(): boolean {
  return supabaseReady;
}
