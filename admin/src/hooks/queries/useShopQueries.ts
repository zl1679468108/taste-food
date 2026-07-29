import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShops, getShop, getBusinessHours,
  createShop, updateShop, updateBusinessHours, updateShopStatus, deleteShop,
  Shop, BusinessHours,
} from '@/services/shop';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

// ---- 查询 ----

export function useShops(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.shops.list(),
    queryFn: () => getShops(),
    enabled: options?.enabled ?? true,
    staleTime: STALE_TIMES.STATIC,
  });
}

export function useShop(id: string) {
  return useQuery({
    queryKey: queryKeys.shops.detail(id),
    queryFn: () => getShop(id),
    enabled: !!id,
    staleTime: STALE_TIMES.STATIC,
  });
}

export function useBusinessHours(id: string) {
  return useQuery({
    queryKey: queryKeys.shops.businessHours(id),
    queryFn: () => getBusinessHours(id),
    enabled: !!id,
    staleTime: STALE_TIMES.STATIC,
  });
}

// ---- 变更 ----

export function useCreateShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Shop>) => createShop(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shops.all() }),
  });
}

export function useUpdateShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Shop> }) => updateShop(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.shops.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.shops.list() });
    },
  });
}

export function useUpdateBusinessHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, businessHours }: { id: string; businessHours: BusinessHours }) =>
      updateBusinessHours(id, businessHours),
    onSuccess: (_res, { id }) =>
      qc.invalidateQueries({ queryKey: queryKeys.shops.businessHours(id) }),
  });
}

export function useUpdateShopStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateShopStatus(id, status),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.shops.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.shops.list() });
    },
  });
}

export function useDeleteShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteShop(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shops.all() }),
  });
}
