import { antdTheme } from '../src/theme';
import { defineConfig } from '@umijs/max';
import path from 'node:path';
import routes from './routes';
import proxy from './proxy';

// 共享包源码路径（monorepo workspace，源码直接引用，无需构建）
const sharedPath = path.resolve(__dirname, '../../shared/src');

export default defineConfig({
  antd: {
    theme: antdTheme,
  },
  access: {},
  model: {},
  initialState: {},
  request: {},
  locale: false,
  layout: {
    title: '小买卖管理后台',
  },
  routes,
  proxy,
  esbuildMinifyIIFE: true,
  npmClient: 'npm',
  alias: {
    '@taste-food/shared': sharedPath,
  },
  // 将腾讯地图 Key 注入前端，兼容 UMI_APP_* 与历史 REACT_APP_*
  define: {
    'process.env.UMI_APP_TENCENT_MAP_KEY': JSON.stringify(
      process.env.UMI_APP_TENCENT_MAP_KEY || process.env.REACT_APP_TENCENT_MAP_KEY || '',
    ),
    'process.env.REACT_APP_TENCENT_MAP_KEY': JSON.stringify(
      process.env.REACT_APP_TENCENT_MAP_KEY || process.env.UMI_APP_TENCENT_MAP_KEY || '',
    ),
  },
});
