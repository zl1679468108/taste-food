import { useDidShow } from '@tarojs/taro';
import { setTabBarSelectedPath } from '../utils/tab-bar';

/**
 * 在 tab 页显示时同步自定义 tabBar 激活态。
 * 微信自定义 tabBar 是独立实例，switchTab 后不会自动按路由重渲染。
 */
export function useSyncTabBar(pagePath: string): void {
  useDidShow(() => {
    setTabBarSelectedPath(pagePath);
  });
}
