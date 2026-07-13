// 生产环境域名，优先从环境变量读取（部署时通过 PROD_API_HOST 注入）
const PROD_API_HOST = process.env.PROD_API_HOST || 'api.example.com';

const config = {
  // 生产环境配置
  env: {
    NODE_ENV: '"production"',
    API_BASE_URL: `"https://${PROD_API_HOST}/api"`,
    WS_URL: `"wss://${PROD_API_HOST}"`,
  },
  mini: {
    ...{},
  },
};

export default config;
