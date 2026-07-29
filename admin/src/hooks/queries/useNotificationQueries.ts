import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listNotifications, getUnreadCount,
  markNotificationRead, markAllNotificationsRead,
} from '@/services/notification';
import { queryKeys } from './queryKeys';
import { STALE_TIMES } from '@/lib/queryClient';

// ---- 查询 ----

export function useNotifications(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: queryKeys.notifications.list(page, pageSize),
    queryFn: () => listNotifications(page, pageSize),
    staleTime: STALE_TIMES.REALTIME,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => getUnreadCount(),
    staleTime: STALE_TIMES.REALTIME,
    refetchInterval: 60 * 1000,
  });
}

// ---- 变更 ----

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all() }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all() }),
  });
}
