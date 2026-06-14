/**
 * 环境变量配置
 * 小程序中使用 process.env 需要在 Taro 编译配置中定义
 * 或者直接在这里硬编码默认值
 */

// API 基础地址
export const API_BASE_URL: string =
  process.env.API_BASE_URL || 'http://localhost:3001/api';

// WebSocket 地址
export const WS_URL: string =
  process.env.WS_URL || 'ws://localhost:3001';

// Supabase 配置（直接从环境变量读取，或在编译时注入）
export const SUPABASE_URL: string =
  process.env.SUPABASE_URL || 'http://localhost:54321';

export const SUPABASE_ANON_KEY: string =
  process.env.SUPABASE_ANON_KEY || '';

// 店铺默认 ID（开发环境使用）
export const DEFAULT_SHOP_ID: string = '00000000-0000-0000-0000-000000000001';

// 分页默认值
export const DEFAULT_PAGE_SIZE: number = 20;
