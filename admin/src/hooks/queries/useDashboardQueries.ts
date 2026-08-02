/**
 * Dashboard 数据看板专用查询层
 *
 * 设计要点：
 * 1. 后端 `GET /api/orders/stats/daily` 支持 `start_date` / `end_date`（优先于 days），
 *    因此自定义日期区间可以精确取数，无需前端按 days 反推后裁剪。
 * 2. 后端 `GET /api/orders/stats/today` 与 `stats/daily` 在不传 `shop_id` 时
 *    会回退到 JWT 绑定店 / DEFAULT_SHOP_ID（见 server 端 resolveAdminTargetShopId），
 *    **不会**返回跨店聚合数据。因此「全店汇总」在前端通过对店铺列表逐店取数后
 *    客户端聚合实现（fan-out + merge），语义真实但请求数 = 店铺数。
 * 3. 逐店查询复用 queryKeys.orders.* 缓存键，与其他页面共享缓存，避免重复请求。
 */
import { useEffect, useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { antdMessage as message } from '@/utils/antdApp';
import {
  getDailyStats,
  getOrderStats,
  type DailyStatsItem,
  type OrderStats,
} from '@/services/order';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

export interface DashboardDateRange {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
}

export interface DashboardStatsParams {
  /** 参与统计的店铺 ID 列表：单店口径长度为 1，全店汇总为全部店铺 */
  shopIds: string[];
  /** 取数区间（含首尾），已由调用方扩展到「本期 + 上一等长期」 */
  range: DashboardDateRange;
  /** 区间天数，用于 days 兜底参数 */
  days: number;
  enabled?: boolean;
}

export interface DashboardStatsResult {
  /** 今日实时统计（多店时为各店求和） */
  todayStats: OrderStats;
  /** 日趋势（多店时按日期合并求和），按日期升序 */
  dailyStats: DailyStatsItem[];
  /** 首屏加载中（无任何缓存数据） */
  isLoading: boolean;
  /** 后台刷新中 */
  isFetching: boolean;
  isError: boolean;
  /** 参与聚合的店铺数量 */
  shopCount: number;
}

const EMPTY_TODAY_STATS: OrderStats = {
  totalOrders: 0,
  totalRevenue: 0,
  pendingCount: 0,
  preparingCount: 0,
  completedCount: 0,
};

/** 合并多店今日统计 */
function mergeTodayStats(list: (OrderStats | undefined)[]): OrderStats {
  return list.reduce<OrderStats>((acc, cur) => {
    if (!cur) return acc;
    return {
      totalOrders: acc.totalOrders + (cur.totalOrders || 0),
      totalRevenue: acc.totalRevenue + (cur.totalRevenue || 0),
      pendingCount: acc.pendingCount + (cur.pendingCount || 0),
      preparingCount: acc.preparingCount + (cur.preparingCount || 0),
      completedCount: acc.completedCount + (cur.completedCount || 0),
    };
  }, { ...EMPTY_TODAY_STATS });
}

/** 按日期合并多店日趋势，输出按日期升序 */
function mergeDailyStats(list: (DailyStatsItem[] | undefined)[]): DailyStatsItem[] {
  const bucket = new Map<string, DailyStatsItem>();
  list.forEach((items) => {
    (items || []).forEach((item) => {
      if (!item?.date) return;
      const prev = bucket.get(item.date);
      if (prev) {
        prev.orders += item.orders || 0;
        prev.revenue += item.revenue || 0;
      } else {
        bucket.set(item.date, {
          date: item.date,
          orders: item.orders || 0,
          revenue: item.revenue || 0,
        });
      }
    });
  });
  return Array.from(bucket.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Dashboard 统计聚合查询。
 *
 * 单店口径传单元素 shopIds，全店汇总口径传全部店铺 ID。
 */
export function useDashboardStats(params: DashboardStatsParams): DashboardStatsResult {
  const { shopIds, range, days, enabled = true } = params;

  // shopIds 引用每次渲染都会变，用序列化后的稳定值参与依赖
  const shopIdsKey = shopIds.join(',');
  const stableShopIds = useMemo(
    () => (shopIdsKey ? shopIdsKey.split(',') : []),
    [shopIdsKey],
  );

  const active = enabled && stableShopIds.length > 0;
  const rangeKey = `${range.startDate}_${range.endDate}`;

  const todayQueries = useQueries({
    queries: stableShopIds.map((id) => ({
      queryKey: queryKeys.orders.statsToday(id),
      queryFn: () => getOrderStats(id),
      enabled: active,
      staleTime: STALE_TIMES.REALTIME,
      // 全店汇总为逐店 fan-out，店铺较多时关闭轮询，避免请求风暴
      refetchInterval: stableShopIds.length <= 5 ? 30 * 1000 : (false as const),
    })),
  });

  const dailyQueries = useQueries({
    queries: stableShopIds.map((id) => ({
      queryKey: queryKeys.orders.statsDaily(id, days, rangeKey),
      queryFn: () => getDailyStats(id, days, range),
      enabled: active,
      staleTime: STALE_TIMES.REALTIME,
    })),
  });

  const allQueries = [...todayQueries, ...dailyQueries];
  const isError = allQueries.some((q) => q.isError);
  const isFetching = allQueries.some((q) => q.isFetching);
  const isLoading = active && allQueries.some((q) => q.isLoading);

  // 请求失败统一提示，避免静默失败；同一错误只提示一次
  const errorNotifiedRef = useRef(false);
  useEffect(() => {
    if (isError && !errorNotifiedRef.current) {
      errorNotifiedRef.current = true;
      message.error('统计数据加载失败，请稍后重试');
    }
    if (!isError) {
      errorNotifiedRef.current = false;
    }
  }, [isError]);

  // 店铺数量有限、数据量小，直接合并即可，避免 memo 依赖失真
  const todayStats = mergeTodayStats(todayQueries.map((q) => q.data));
  const dailyStats = mergeDailyStats(dailyQueries.map((q) => q.data));

  return {
    todayStats,
    dailyStats,
    isLoading,
    isFetching,
    isError,
    shopCount: stableShopIds.length,
  };
}
