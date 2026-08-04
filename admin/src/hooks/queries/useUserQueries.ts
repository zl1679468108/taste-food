import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsers, getMe, getUserProfile, createUser, updateUser, updateMe,
  CreateUserPayload, UpdateUserPayload, GetUsersParams, UserProfile,
} from '@/services/user';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

// ---- 查询 ----

export function useUsers(params: GetUsersParams) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => getUsers(params),
    staleTime: STALE_TIMES.STANDARD,
  });
}

/** 用户画像（抽屉数据源；§3.24 / T312.1） */
export function useUserProfile(userId?: string) {
  return useQuery<UserProfile>({
    queryKey: userId ? queryKeys.users.profile(userId) : ['users', 'profile', 'noop'],
    queryFn: () => getUserProfile(userId as string),
    enabled: !!userId,
    staleTime: STALE_TIMES.STANDARD,
  });
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => getMe(),
    staleTime: STALE_TIMES.STATIC,
  });
}

// ---- 变更 ----

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserPayload) => createUser(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all() }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserPayload }) => updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all() }),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Pick<UpdateUserPayload, 'nickName' | 'avatarUrl'>) => updateMe(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all() }),
  });
}
