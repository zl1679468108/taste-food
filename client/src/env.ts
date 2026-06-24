/**
 * 环境变量配置
 * 小程序中使用 process.env 需要在 Taro 编译配置中定义
 * 或者直接在这里修改默认值
 */

// API 基础地址
// 小程序模拟器中 localhost 无法访问宿主机，请使用 127.0.0.1 或局域网 IP
export const API_BASE_URL: string =
  process.env.API_BASE_URL || 'http://127.0.0.1:3010/api';

// WebSocket 地址
export const WS_URL: string =
  process.env.WS_URL || 'ws://127.0.0.1:3010';

// Supabase 配置
export const SUPABASE_URL: string =
  process.env.SUPABASE_URL || 'http://localhost:54321';

export const SUPABASE_ANON_KEY: string =
  process.env.SUPABASE_ANON_KEY || '';

// 店铺默认 ID（开发环境使用）
export const DEFAULT_SHOP_ID: string = '00000000-0000-0000-0000-000000000001';

// 分页默认值
export const DEFAULT_PAGE_SIZE: number = 20;
