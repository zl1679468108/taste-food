import { QueryClient } from '@tanstack/react-query';

/**
 * staleTime 分级策略
 *  STATIC   菜单分类、店铺配置  5 min  低频变更
 *  STANDARD 菜品列表、促销列表  2 min
 *  REALTIME 订单列表、今日统计 30 sec  需感知变化
 *  INSTANT  订单详情           0      每次进入都刷新
 */
export const STALE_TIMES = {
  STATIC: 5 * 60 * 1000,
  STANDARD: 2 * 60 * 1000,
  REALTIME: 30 * 1000,
  INSTANT: 0,
} as const;

// 非活跃 query 在内存中保留 10 min，保证切换模块后仍有缓存可用
const GC_TIME = 10 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIMES.STANDARD,
      gcTime: GC_TIME,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});
