import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsers, getMe, createUser, updateUser, updateMe,
  CreateUserPayload, UpdateUserPayload,
} from '@/services/user';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

// ---- 查询 ----

export function useUsers(params: { page: number; pageSize: number; role?: string }) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => getUsers(params),
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
