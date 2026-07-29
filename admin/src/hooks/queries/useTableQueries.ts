import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTables, createTable, updateTable, deleteTable, seedTables,
} from '@/services/table';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

// ---- 查询 ----

export function useTables(shopId: string) {
  return useQuery({
    queryKey: queryKeys.tables.list(shopId),
    queryFn: () => listTables(shopId),
    enabled: !!shopId,
    staleTime: STALE_TIMES.STATIC,
  });
}

// ---- 变更 ----

type TableCreatePayload = { tableNo: string; label?: string; sortOrder?: number; active?: boolean };
type TableUpdatePayload = Partial<{ tableNo: string; label: string; sortOrder: number; active: boolean }>;

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shopId, data }: { shopId: string; data: TableCreatePayload }) =>
      createTable(shopId, data),
    onSuccess: (_res, { shopId }) =>
      qc.invalidateQueries({ queryKey: queryKeys.tables.list(shopId) }),
  });
}

export function useUpdateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shopId, tableId, data }: { shopId: string; tableId: string; data: TableUpdatePayload }) =>
      updateTable(shopId, tableId, data),
    onSuccess: (_res, { shopId }) =>
      qc.invalidateQueries({ queryKey: queryKeys.tables.list(shopId) }),
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shopId, tableId }: { shopId: string; tableId: string }) =>
      deleteTable(shopId, tableId),
    onSuccess: (_res, { shopId }) =>
      qc.invalidateQueries({ queryKey: queryKeys.tables.list(shopId) }),
  });
}

export function useSeedTables() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shopId: string) => seedTables(shopId),
    onSuccess: (_res, shopId) =>
      qc.invalidateQueries({ queryKey: queryKeys.tables.list(shopId) }),
  });
}
