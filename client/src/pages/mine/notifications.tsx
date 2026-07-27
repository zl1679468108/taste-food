import { useCallback, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { get, patch } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatRelativeTime } from '../../utils/format';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import './notifications.scss';

interface InboxItem {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface ListResult {
  items: InboxItem[];
  total: number;
  page: number;
  pageSize: number;
}

export default function NotificationsPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [marking, setMarking] = useState(false);

  const loadList = useCallback(async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await get<ListResult>('/notifications', { page: 1, pageSize: 50 }, { showError: false });
      setItems(res.data?.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useDidShow(() => {
    loadList();
  });

  usePullDownRefresh(async () => {
    await loadList();
    Taro.stopPullDownRefresh();
  });

  const markRead = async (id: string) => {
    try {
      await patch(`/notifications/${id}/read`, {}, { showError: false });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // ignore
    }
  };

  const markAll = async () => {
    if (marking) return;
    setMarking(true);
    try {
      await patch('/notifications/read-all', {}, { showError: true });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      Taro.showToast({ title: '已全部已读', icon: 'success' });
    } catch {
      // handled
    } finally {
      setMarking(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <View className='notif-page'>
        <EmptyState
          icon='lock'
          title='请先登录'
          actionText='去登录'
          onAction={() => Taro.navigateTo({ url: '/pages/auth/login' })}
        />
      </View>
    );
  }

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <View className='notif-page'>
      <View className='notif-page__toolbar'>
        <Text className='notif-page__count'>
          {unread > 0 ? `${unread} 条未读` : '全部已读'}
        </Text>
        {unread > 0 && (
          <Text className='notif-page__action' onClick={() => !marking && markAll()}>
            {marking ? '处理中...' : '全部已读'}
          </Text>
        )}
      </View>

      {loading ? (
        <SkeletonLoader mode='list' count={4} />
      ) : items.length === 0 ? (
        <EmptyState icon='bell' title='暂无消息' description='审批结果与系统通知会出现在这里' />
      ) : (
        <View className='notif-page__list'>
          {items.map((item) => (
            <View
              key={item.id}
              className={`notif-page__item${item.isRead ? '' : ' is-unread'}`}
              onClick={() => !item.isRead && markRead(item.id)}
            >
              <View className='notif-page__item-head'>
                <Text className='notif-page__title'>{item.title}</Text>
                {!item.isRead && <View className='notif-page__dot' />}
              </View>
              <Text className='notif-page__content'>{item.content}</Text>
              <Text className='notif-page__time'>{formatRelativeTime(item.createdAt)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
