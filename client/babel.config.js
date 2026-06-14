// babel-preset-taro 更多配置和说明：
// https://github.com/NervJS/taro/blob/next/packages/babel-preset-taro/README.md
module.exports = {
  presets: [
    ['taro', {
      framework: 'react',
      ts: true,
    }],
  ],
  plugins: [
    '@babel/plugin-transform-runtime',
  ],
};
