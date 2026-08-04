import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShopCustomers,
  getShopCustomerProfile,
  getShopTags,
  createShopTag,
  updateShopTag,
  deleteShopTag,
  getCustomerTags,
  setCustomerTags,
  GetShopCustomersParams,
  CustomerTag,
} from '@/services/customer';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

/** 商家视角：本店顾客列表 */
export function useShopCustomers(params: GetShopCustomersParams) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => getShopCustomers(params),
    staleTime: STALE_TIMES.STANDARD,
    placeholderData: (prev) => prev,
  });
}

/** 商家视角：单顾客在本店的画像 */
export function useShopCustomerProfile(id?: string) {
  return useQuery({
    queryKey: queryKeys.customers.profile(id || ''),
    queryFn: () => getShopCustomerProfile(id as string),
    enabled: !!id,
    staleTime: STALE_TIMES.STANDARD,
  });
}

/** 商家视角：单顾客在本店的标签 */
export function useCustomerTags(id?: string) {
  return useQuery({
    queryKey: queryKeys.customers.tags(id || ''),
    queryFn: () => getCustomerTags(id as string),
    enabled: !!id,
    staleTime: STALE_TIMES.STANDARD,
  });
}

/** 店铺标签列表 */
export function useShopTags() {
  return useQuery({
    queryKey: queryKeys.shopTags.list(),
    queryFn: () => getShopTags(),
    staleTime: STALE_TIMES.STANDARD,
  });
}

/** 新建标签 */
export function useCreateShopTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => createShopTag(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shopTags.all() });
      qc.invalidateQueries({ queryKey: queryKeys.customers.all() });
    },
  });
}

/** 更新标签 */
export function useUpdateShopTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      updateShopTag(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shopTags.all() });
      qc.invalidateQueries({ queryKey: queryKeys.customers.all() });
    },
  });
}

/** 删除标签 */
export function useDeleteShopTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteShopTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shopTags.all() });
      qc.invalidateQueries({ queryKey: queryKeys.customers.all() });
    },
  });
}

/** 设置某顾客标签（全量替换） */
export function useSetCustomerTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tagIds }: { id: string; tagIds: string[] }) =>
      setCustomerTags(id, tagIds),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.customers.tags(variables.id) });
      qc.invalidateQueries({ queryKey: queryKeys.customers.all() });
    },
  });
}

/** 标签列表类型再导出，便于组件使用 */
export type { CustomerTag };
