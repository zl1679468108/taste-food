import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShopCustomers,
  getShopCustomerProfile,
  GetShopCustomersParams,
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
