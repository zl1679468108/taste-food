import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn(
        '[Supabase] SUPABASE_URL 或 SUPABASE_KEY 未配置，请检查 .env 文件。使用模拟模式。',
      );
      // 返回一个模拟客户端
      return null as unknown as SupabaseClient;
    }

    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseInstance;
}

// 导出单例实例以便直接使用
export const supabase = getSupabaseClient();
