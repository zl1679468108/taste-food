import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrders, getOrder, updateOrderStatus, cancelOrder, resolveCancelRequest,
  getOrderStats, getDailyStats,
} from '@/services/order';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

// ---- 订单列表（REALTIME：30s 自动过期） ----

export function useOrders(params: {
  shopId: string;
  /** 平台管理员全店视角：不传 shop_id，由后端跨店查询 */
  allShops?: boolean;
  status?: string;
  page: number;
  pageSize: number;
  keyword?: string;
}) {
  const effectiveShopId = params.allShops ? undefined : params.shopId || undefined;
  return useQuery({
    queryKey: queryKeys.orders.list({ shopId: effectiveShopId ?? '', allShops: params.allShops, status: params.status, page: params.page, pageSize: params.pageSize }),
    queryFn: () =>
      getOrders({ shop_id: effectiveShopId, status: params.status, page: params.page, pageSize: params.pageSize, keyword: params.keyword }),
    enabled: params.allShops || !!params.shopId,
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

export function useDailyStats(
  shopId: string | undefined,
  days = 7,
  range?: { startDate?: string; endDate?: string },
) {
  const rangeKey =
    range?.startDate && range?.endDate ? `${range.startDate}_${range.endDate}` : '';
  return useQuery({
    queryKey: queryKeys.orders.statsDaily(shopId, days, rangeKey),
    queryFn: () => getDailyStats(shopId, days, range),
    enabled: !!shopId,
    staleTime: STALE_TIMES.REALTIME,
  });
}

// ---- 变更 ----

function invalidateOrderQueries(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.orders.detail(id) });
  qc.invalidateQueries({ queryKey: queryKeys.orders.all() });
  qc.invalidateQueries({ queryKey: ['orders', 'stats'] });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
      estimatedMinutes,
    }: {
      id: string;
      status: string;
      reason?: string;
      estimatedMinutes?: number;
    }) => updateOrderStatus(id, status, reason, estimatedMinutes),
    onSuccess: (_res, { id }) => {
      // 精准失效：详情 + 列表 + 今日统计
      invalidateOrderQueries(qc, id);
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelOrder(id, reason),
    onSuccess: (_res, { id }) => {
      invalidateOrderQueries(qc, id);
    },
  });
}

export function useResolveCancelRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      approve,
      reason,
    }: {
      id: string;
      approve: boolean;
      reason?: string;
    }) => resolveCancelRequest(id, { approve, reason }),
    onSuccess: (_res, { id }) => {
      invalidateOrderQueries(qc, id);
    },
  });
}
