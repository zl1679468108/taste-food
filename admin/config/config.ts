import { defineConfig } from '@umijs/max';
import routes from './routes';
import proxy from './proxy';

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
});
