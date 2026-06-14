import type { UserConfig } from '@tarojs/cli';

const config: UserConfig = {
  // 开发环境配置
  env: {
    NODE_ENV: '"development"',
    API_BASE_URL: '"http://localhost:3001/api"',
    WS_URL: '"ws://localhost:3001"',
  },
  mini: {
    ...{},
  },
};

export default config;
