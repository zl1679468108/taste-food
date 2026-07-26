/**
 * 环境变量配置
 *
 * 真机调试注意：
 * - 微信小程序真机无法访问本机 127.0.0.1 / localhost
 * - 真机必须把 API_BASE_URL / WS_URL 设为电脑局域网 IP，例如：
 *   http://192.168.1.10:3010/api  /  ws://192.168.1.10:3010
 * - 模拟器可用 127.0.0.1（推荐）或局域网 IP
 * - 小程序中 process.env.XXX 必须由 Taro DefinePlugin 在编译期替换为字面量
 *   （见 config/index.ts merge dev/prod + config/dev.ts env）
 * - 若未注入，运行时没有 Node process，会直接白屏
 */

// API 基础地址（编译期由 config/dev.ts 或 config/prod.ts 注入）
export const API_BASE_URL: string =
  process.env.API_BASE_URL || 'http://192.168.0.112:3010/api';

// WebSocket 地址
export const WS_URL: string =
  process.env.WS_URL || 'ws://192.168.0.112:3010';

// Supabase 配置
export const SUPABASE_URL: string =
  process.env.SUPABASE_URL || 'http://localhost:54321';

export const SUPABASE_ANON_KEY: string =
  process.env.SUPABASE_ANON_KEY || '';

// 店铺默认 ID（开发环境使用）
export const DEFAULT_SHOP_ID: string = '00000000-0000-0000-0000-000000000001';

// 小程序列表默认分页大小
export const DEFAULT_PAGE_SIZE = 20;

const isTestEnv = process.env.NODE_ENV === 'test';

// 开发态提示：API 指向 127.0.0.1 时真机连不上（不影响模拟器）
if (process.env.NODE_ENV !== 'production' && !isTestEnv) {
  if (
    /127\.0\.0\.1|localhost/.test(API_BASE_URL) ||
    /127\.0\.0\.1|localhost/.test(WS_URL)
  ) {
    console.warn(
      '[env] API/WS 使用了 127.0.0.1/localhost。模拟器可访问；真机调试请改为电脑局域网 IP（如 http://192.168.x.x:3010/api）。',
    );
  }
}
