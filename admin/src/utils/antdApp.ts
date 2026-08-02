import { message } from 'antd';

/**
 * 全局 message 单例（antd v5 App 上下文方案）。
 *
 * 问题：antd v5 中 `import { message } from 'antd'` 的静态调用会告警
 * "Static function can not consume context"，因为它不走 React context、无法消费
 * ConfigProvider 主题，且非组件模块（request 拦截器、app.tsx 回调）无法用 App.useApp()。
 *
 * 方案：在应用根（app.tsx 的 rootContainer）用 message.useMessage() 渲染一个 holder，
 * 把实例写入本模块的 instance；所有业务代码统一从本模块导入 antdMessage 作为 message，
 * 既消除告警，又能在根挂载前安全回退到静态 message（避免首屏崩溃）。
 */
type MessageApi = ReturnType<typeof message.useMessage>[0];

let instance: MessageApi | null = null;

export function setAntdMessage(api: MessageApi): void {
  instance = api;
}

export const antdMessage: MessageApi = new Proxy(message, {
  get(target, prop) {
    const src = (instance ?? target) as unknown as Record<string | symbol, unknown>;
    const val = src[prop as string];
    if (typeof val === 'function') {
      return (val as (...args: unknown[]) => unknown).bind(src);
    }
    return val;
  },
}) as unknown as MessageApi;
