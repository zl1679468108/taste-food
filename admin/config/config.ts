import { defineConfig } from '@umijs/max';
import path from 'node:path';
import routes from './routes';
import proxy from './proxy';

// 共享包源码路径（monorepo workspace，源码直接引用，无需构建）
const sharedPath = path.resolve(__dirname, '../../packages/shared/src');

export default defineConfig({
  antd: {},
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
});
