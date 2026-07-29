import type { UserConfigExport } from '@tarojs/cli';

/**
 * 开发环境配置
 * - 当前按真机调试配置：使用电脑局域网 IP 192.168.0.112
 * - 仅本机模拟器调试时可临时改回 127.0.0.1
 * - 这里的 env 会在编译期替换 process.env.XXX；漏配会在小程序里白屏
 */
const config: UserConfigExport<'webpack5'> = {
  env: {
    NODE_ENV: '"development"',
    API_BASE_URL: '"http://192.168.0.112:3010/api"',
    WS_URL: '"ws://192.168.0.112:3010"',
    SUPABASE_URL: '""',
    SUPABASE_ANON_KEY: '""',
  },
  mini: {},
};

export default config;
