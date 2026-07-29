import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPromotions, createPromotion, updatePromotion, deletePromotion, Promotion,
} from '@/services/promotion';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

// ---- 查询 ----

export function usePromotions(shopId?: string) {
  return useQuery({
    queryKey: queryKeys.promotions.list(shopId),
    queryFn: () => getPromotions(shopId),
    staleTime: STALE_TIMES.STANDARD,
  });
}

// ---- 变更 ----

export function useCreatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Promotion>) => createPromotion(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.promotions.all() }),
  });
}

export function useUpdatePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, shopId }: { id: string; data: Partial<Promotion>; shopId?: string }) =>
      updatePromotion(id, data, shopId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.promotions.all() }),
  });
}

export function useDeletePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, shopId }: { id: string; shopId?: string }) => deletePromotion(id, shopId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.promotions.all() }),
  });
}
