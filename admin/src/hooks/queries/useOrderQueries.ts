import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrders, getOrder, updateOrderStatus, cancelOrder,
  getOrderStats, getDailyStats, getStatusDistribution,
} from '@/services/order';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

// ---- 订单列表（REALTIME：30s 自动过期） ----

export function useOrders(params: {
  shopId: string;
  status?: string;
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () =>
      getOrders({ shop_id: params.shopId, status: params.status, page: params.page, pageSize: params.pageSize }),
    enabled: !!params.shopId,
    staleTime: STALE_TIMES.REALTIME,
    // 轮询兜底：若 WebSocket 没推送，30s 主动拉一次
    refetchInterval: 30 * 1000,
  });
}

// ---- 订单详情（INSTANT：每次进入都拉最新） ----

export function useOrderDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => getOrder(id),
    enabled: !!id,
    staleTime: STALE_TIMES.INSTANT,
  });
}

// ---- 统计数据 ----

export function useOrderStatsToday(shopId?: string) {
  return useQuery({
    queryKey: queryKeys.orders.statsToday(shopId),
    queryFn: () => getOrderStats(shopId),
    staleTime: STALE_TIMES.REALTIME,
    refetchInterval: 30 * 1000,
  });
}

export function useDailyStats(shopId: string | undefined, days = 7) {
  return useQuery({
    queryKey: queryKeys.orders.statsDaily(shopId, days),
    queryFn: () => getDailyStats(shopId, days),
    enabled: !!shopId,
    staleTime: STALE_TIMES.REALTIME,
  });
}

export function useStatusDistribution(shopId?: string, days?: number) {
  return useQuery({
    queryKey: queryKeys.orders.statsStatus(shopId, days),
    queryFn: () => getStatusDistribution(shopId, days),
    staleTime: STALE_TIMES.REALTIME,
  });
}

// ---- 变更 ----

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      updateOrderStatus(id, status, reason),
    onSuccess: (_res, { id }) => {
      // 精准失效：详情 + 列表 + 今日统计
      qc.invalidateQueries({ queryKey: queryKeys.orders.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.orders.all() });
      qc.invalidateQueries({ queryKey: ['orders', 'stats'] });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelOrder(id, reason),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.orders.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.orders.all() });
      qc.invalidateQueries({ queryKey: ['orders', 'stats'] });
    },
  });
}
