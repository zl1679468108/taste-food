import path from 'node:path';
import { defineConfig } from '@tarojs/cli';

// 获取 engine.io-client 的实际路径用于精确 alias
const engineIOClientPath = path.dirname(
  require.resolve('engine.io-client/package.json')
);

export default defineConfig({
  projectName: 'taste-food',
  framework: 'react',
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-http'],
  copy: {
    patterns: [
      { from: 'src/assets/', to: 'dist/assets/' },
    ],
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {
          designWidth: 375,
          deviceRatio: {
            375: 2,
            750: 1,
          },
        },
      },
      url: {
        enable: true,
        config: {
          limit: 1024,
        },
      },
    },
    webpackChain(chain) {
      const esmDir = path.join(engineIOClientPath, 'build/esm/transports');
      const cjsDir = path.join(engineIOClientPath, 'build/cjs/transports');

      chain.resolve.alias.set(
        path.join(esmDir, 'polling-xhr.node.js'),
        path.join(esmDir, 'polling-xhr.js')
      );
      chain.resolve.alias.set(
        path.join(esmDir, 'websocket.node.js'),
        path.join(esmDir, 'websocket.js')
      );

      chain.resolve.alias.set(
        path.join(cjsDir, 'polling-xhr.node.js'),
        path.join(cjsDir, 'polling-xhr.js')
      );
      chain.resolve.alias.set(
        path.join(cjsDir, 'websocket.node.js'),
        path.join(cjsDir, 'websocket.js')
      );

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
