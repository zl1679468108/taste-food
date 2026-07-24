import { useCallback } from 'react';
import Taro, { usePullDownRefresh } from '@tarojs/taro';

/**
 * 统一下拉刷新：自动 stopPullDownRefresh，避免动画卡死
 */
export function usePullRefresh(loader: () => void | Promise<void>) {
  const onRefresh = useCallback(async () => {
    try {
      await loader();
    } finally {
      Taro.stopPullDownRefresh();
    }
  }, [loader]);

  usePullDownRefresh(() => {
    void onRefresh();
  });
}
