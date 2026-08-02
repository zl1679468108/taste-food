import path from 'node:path';
import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import devConfig from './dev';
import prodConfig from './prod';

// 获取 engine.io-client 的实际路径用于精确 alias
const engineIOClientPath = path.dirname(
  require.resolve('engine.io-client/package.json')
);

// 共享包源码路径（monorepo workspace，源码直接引用，无需构建）
const sharedPath = path.resolve(__dirname, '../../shared/src');

/**
 * 注意：必须用函数形式 merge dev/prod，
 * 否则 config/dev.ts 的 env 不会注入 DefinePlugin，
 * 小程序运行时访问 process.env.API_BASE_URL 会直接 ReferenceError 白屏。
 */
export default defineConfig<'webpack5'>(async (merge) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'taste-food',
    framework: 'react',
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: ['@tarojs/plugin-http'],
    compile: {
      include: [
        (filename: string) => filename.startsWith(sharedPath),
      ],
    },
    miniCssExtractPluginOption: {
      ignoreOrder: true,
    },
    copy: {
      patterns: [
        { from: 'src/assets/', to: 'dist/assets/' },
      ],
      options: {},
    },
    mini: {
      compile: {
        include: [
          (filename: string) => filename.startsWith(sharedPath),
        ],
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
      },
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

        // @taste-food/shared 源码直接引用
        chain.resolve.alias.set('@taste-food/shared', sharedPath);
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
      webpackChain(chain) {
        chain.resolve.alias.set('@taste-food/shared', sharedPath);
      },
    },
  };

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig);
  }
  return merge({}, baseConfig, prodConfig);
});
