import path from 'node:path';
import { defineConfig } from '@tarojs/cli';

// 获取 engine.io-client 的实际路径用于精确 alias
const engineIOClientPath = path.dirname(
  require.resolve('engine.io-client/package.json')
);

export default defineConfig({
  // 项目名称
  projectName: 'taste-food',
  // 框架类型
  framework: 'react',
  // 源码目录
  sourceRoot: 'src',
  // 输出目录
  outputRoot: 'dist',
  // 插件：为小程序提供 XMLHttpRequest / WebSocket 等 BOM 接口 polyfill
  plugins: ['@tarojs/plugin-http'],
  // 拷贝静态资源到输出目录（tabBar 图标等）
  copy: {
    patterns: [
      { from: 'src/assets/', to: 'dist/assets/' },
    ],
  },
  // 小程序配置
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      url: {
        enable: true,
        config: {
          limit: 1024, // 设定转换上限，小于 1kb 的图片转为 base64
        },
      },
    },
    webpackChain(chain) {
      // 将 engine.io-client 的 Node 版本 transport 映射到浏览器版本
      // 浏览器版使用全局 XMLHttpRequest（由 @tarojs/plugin-http 注入）
      // 以及全局 WebSocket（由 websocket-polyfill 在 app.tsx 注入）
      const esmDir = path.join(engineIOClientPath, 'build/esm/transports');
      const cjsDir = path.join(engineIOClientPath, 'build/cjs/transports');

      // ESM 版本
      chain.resolve.alias.set(
        path.join(esmDir, 'polling-xhr.node.js'),
        path.join(esmDir, 'polling-xhr.js')
      );
      chain.resolve.alias.set(
        path.join(esmDir, 'websocket.node.js'),
        path.join(esmDir, 'websocket.js')
      );

      // CJS 版本
      chain.resolve.alias.set(
        path.join(cjsDir, 'polling-xhr.node.js'),
        path.join(cjsDir, 'polling-xhr.js')
      );
      chain.resolve.alias.set(
        path.join(cjsDir, 'websocket.node.js'),
        path.join(cjsDir, 'websocket.js')
      );

      // globals.node.js → globals.js（ESM & CJS）
      chain.resolve.alias.set(
        path.join(engineIOClientPath, 'build/esm/globals.node.js'),
        path.join(engineIOClientPath, 'build/esm/globals.js')
      );
      chain.resolve.alias.set(
        path.join(engineIOClientPath, 'build/cjs/globals.node.js'),
        path.join(engineIOClientPath, 'build/cjs/globals.js')
      );
    },
  },

  // H5 配置（备用）
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
        config: {},
      },
    },
  },
});
