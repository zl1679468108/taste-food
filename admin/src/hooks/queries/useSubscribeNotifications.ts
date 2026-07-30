import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { InboxNotification } from '@/services/notification';
import { queryKeys } from './queryKeys';

export type NotificationEventHandler = (notification: InboxNotification) => void;

export function useSubscribeNotifications(
  options?: { enabled?: boolean; onNotification?: NotificationEventHandler },
) {
  const qc = useQueryClient();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const enabled = optionsRef.current?.enabled ?? true;
    if (!enabled) return;

    const handler = (notification: InboxNotification) => {
      optionsRef.current?.onNotification?.(notification);

      // 增量刷新：把新通知插入列表头部，避免页面一次性重拉
      qc.setQueryData(queryKeys.notifications.list(1, 20), (old: any) => {
        if (!old?.items) {
          return { items: [notification], total: 1, page: 1, pageSize: 20 };
        }
        const exists = old.items.some((item: InboxNotification) => item.id === notification.id);
        if (exists) return old;
        return { ...old, items: [notification, ...old.items] };
      });

      qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    };

    // 通知由 NotificationBell 内部通过 socket 监听，此处仅提供语义化的订阅组合逻辑。
    // 若后续改为全局 socket 单例，可在此注册/注销 hander。
    return undefined;
  }, [qc]);
}
