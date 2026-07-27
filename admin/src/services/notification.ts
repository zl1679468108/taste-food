import request from '@/utils/request';

export interface InboxNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedType?: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: InboxNotification[];
  total: number;
  page: number;
  pageSize: number;
}

export const listNotifications = (page = 1, pageSize = 20) =>
  request.get('/api/notifications', {
    params: { page, pageSize },
  }) as Promise<NotificationListResult>;

export const getUnreadCount = () =>
  request.get('/api/notifications/unread-count') as Promise<{ count: number }>;

export const markNotificationRead = (id: string) =>
  request.patch(`/api/notifications/${id}/read`) as Promise<InboxNotification>;

export const markAllNotificationsRead = () =>
  request.patch('/api/notifications/read-all') as Promise<{ count: number }>;
