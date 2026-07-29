import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listApplications,
  listMyApplications,
  createRoleApplication,
  reviewApplication,
  checkRoleApplicationEligibility,
  ApplicationStatus,
  ApplyRole,
  CreateRoleApplicationParams,
  ReviewRoleApplicationParams,
} from '@/services/role-application';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

// ---- 查询 ----

/** 管理员：全部申请（待审批需及时感知，用 REALTIME） */
export function useApplications(status?: ApplicationStatus | string) {
  return useQuery({
    queryKey: queryKeys.roleApplications.list(status),
    queryFn: () => listApplications(status),
    staleTime: STALE_TIMES.REALTIME,
  });
}

/** 我的申请列表 */
export function useMyApplications() {
  return useQuery({
    queryKey: queryKeys.roleApplications.mine(),
    queryFn: () => listMyApplications(),
    staleTime: STALE_TIMES.STANDARD,
  });
}

/**
 * 提交前资格校验。role 为空时不请求；shopName 参与 key，
 * 调用方负责防抖后再传入，避免逐字符打请求
 */
export function useRoleApplicationEligibility(role?: ApplyRole, shopName?: string) {
  const normalizedName = role === 'merchant' ? shopName?.trim() || undefined : undefined;
  return useQuery({
    queryKey: queryKeys.roleApplications.eligibility(role, normalizedName),
    queryFn: () => checkRoleApplicationEligibility(role as ApplyRole, normalizedName),
    enabled: !!role,
    staleTime: STALE_TIMES.REALTIME,
    retry: false,
  });
}

// ---- 变更 ----

export function useCreateRoleApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateRoleApplicationParams) => createRoleApplication(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roleApplications.all() }),
  });
}

export function useReviewApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: ReviewRoleApplicationParams }) =>
      reviewApplication(id, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.roleApplications.all() });
      // 审批通过会创建店铺/改用户角色，相关列表一并失效
      qc.invalidateQueries({ queryKey: queryKeys.users.all() });
      qc.invalidateQueries({ queryKey: queryKeys.shops.all() });
    },
  });
}
