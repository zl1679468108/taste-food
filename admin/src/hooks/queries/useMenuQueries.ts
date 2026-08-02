import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem,
  batchUpdateMenuItemStatus,
  getSpecGroups, createSpecGroup, updateSpecGroup, deleteSpecGroup,
  Category, MenuItem, SpecGroup, SpecOption, BatchMenuItemStatusParams,
} from '@/services/menu';
import type { CreateSpecGroupInput } from '@/services/menu';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

// ---- 分类查询 ----

export function useCategories(shopId: string) {
  return useQuery({
    queryKey: queryKeys.categories.list(shopId),
    queryFn: () => getCategories(shopId),
    enabled: !!shopId,
    staleTime: STALE_TIMES.STATIC,
  });
}

// ---- 菜品查询 ----

export function useMenuItems(params: { shopId: string; categoryId?: string; search?: string }) {
  return useQuery({
    queryKey: queryKeys.menuItems.list(params),
    queryFn: () =>
      getMenuItems({ shop_id: params.shopId, category_id: params.categoryId, search: params.search }),
    enabled: !!params.shopId,
    staleTime: STALE_TIMES.STANDARD,
  });
}

// ---- 规格组查询（店铺级，编辑菜品绑定时用） ----

export function useSpecGroups(shopId: string) {
  return useQuery({
    queryKey: queryKeys.specGroups.list(shopId),
    queryFn: () => getSpecGroups(shopId),
    enabled: !!shopId,
    staleTime: STALE_TIMES.STATIC,
  });
}

// ---- 分类变更 ----

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Category>) => createCategory(data),
    onSuccess: (_res, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.categories.list(vars.shopId ?? '') }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) => updateCategory(id, data),
    onSuccess: (_res, { data }) =>
      qc.invalidateQueries({ queryKey: queryKeys.categories.list(data.shopId ?? '') }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, shopId }: { id: string; shopId: string }) => deleteCategory(id),
    onSuccess: (_res, { shopId }) =>
      qc.invalidateQueries({ queryKey: queryKeys.categories.list(shopId) }),
  });
}

// ---- 菜品变更 ----

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MenuItem>) => createMenuItem(data),
    onSuccess: (_res, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.menuItems.all() }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MenuItem> }) => updateMenuItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.menuItems.all() }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.menuItems.all() }),
  });
}

/** 批量上/下架菜品 */
export function useBatchUpdateMenuItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: BatchMenuItemStatusParams) => batchUpdateMenuItemStatus(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.menuItems.all() }),
  });
}

// ---- 规格组变更 ----
export function useCreateSpecGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSpecGroupInput) => createSpecGroup(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['specGroups'] }),
  });
}

export function useUpdateSpecGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSpecGroupInput> }) =>
      updateSpecGroup(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['specGroups'] }),
  });
}

export function useDeleteSpecGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSpecGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['specGroups'] }),
  });
}

export type { SpecGroup, SpecOption } from '@/services/menu';
