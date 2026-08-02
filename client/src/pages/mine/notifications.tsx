import { useCallback, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { get, patch, isDuplicateSubmitError } from '../../utils/request';
import { useAsyncAction, useKeyedAsyncAction } from '../../hooks/useAsyncAction';
import { useAuthStore } from '../../stores/authStore';
import { formatRelativeTime } from '../../utils/format';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import FooterBar from '../../components/FooterBar';
import './notifications.scss';

interface InboxItem {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedType?: string;
  relatedId?: string;
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
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InboxItem[]>([]);
  const { pending: marking, run: runMarkAll } = useAsyncAction();
  const { isPending: isRowPending, run: runRowAction } = useKeyedAsyncAction();

  const loadList = useCallback(async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await get<ListResult>('/notifications', { page: 1, pageSize: 50 }, { showError: false });
      const nextItems = res.data?.items || [];
      setItems(nextItems);
      // 看到审批通过通知时立刻刷新 roles，返回「我的」即可展示切换入口
      if (nextItems.some((item) => item.type === 'role_application_approved')) {
        void fetchMe();
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchMe]);

  useDidShow(() => {
    loadList();
  });

  usePullDownRefresh(async () => {
    await loadList();
    Taro.stopPullDownRefresh();
  });

  const markRead = (id: string) => {
    void runRowAction(`read:${id}`, async () => {
      try {
        await patch(`/notifications/${id}/read`, {}, { showError: false });
        setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      } catch (error) {
        if (isDuplicateSubmitError(error)) return;
        // ignore
      }
    });
  };

  const markAll = () => {
    void runMarkAll(async () => {
      try {
        await patch('/notifications/read-all', {}, { showError: true });
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
        Taro.showToast({ title: '已全部已读', icon: 'success' });
      } catch (error) {
        if (isDuplicateSubmitError(error)) return;
        // handled
      }
    });
  };

  if (!isLoggedIn) {
    return (
      <View className='notif-page'>
        <EmptyState
          icon='lock'
          title='请先登录'
        />
        <FooterBar
          actionOnly
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
          <Text
            className={`notif-page__action${marking ? ' is-disabled' : ''}`}
            onClick={markAll}
          >
            {marking ? '处理中...' : '全部已读'}
          </Text>
        )}
      </View>

      {loading ? (
        <SkeletonLoader mode='notification' count={4} />
      ) : items.length === 0 ? (
        <EmptyState icon='bell' title='暂无消息' description='新订单、售后申请与审批结果会出现在这里' />
      ) : (
        <View className='notif-page__list'>
          {items.map((item) => {
            const readPending = isRowPending(`read:${item.id}`);
            return (
            <View
              key={item.id}
              className={`notif-page__item${item.isRead ? '' : ' is-unread'}${readPending ? ' is-pending' : ''}`}
              onClick={() => {
                const wasUnread = !item.isRead;
                const isApproved = item.type === 'role_application_approved';
                const isOrderMsg =
                  item.relatedType === 'order' ||
                  item.type === 'order_paid' ||
                  item.type === 'order_cancel_request' ||
                  item.type === 'order_cancel_approved' ||
                  item.type === 'order_cancel_rejected';
                if (wasUnread) {
                  markRead(item.id);
                }
                // 仅未读的「申请通过」引导回「我的」切换身份，避免点历史消息反复跳转
                if (isApproved && wasUnread) {
                  void fetchMe().then(() => {
                    Taro.showToast({ title: '可在「我的」切换身份', icon: 'none' });
                    setTimeout(() => {
                      Taro.switchTab({ url: '/pages/mine/index' });
                    }, 400);
                  });
                  return;
                }
                // 订单相关：商家去后台处理，顾客进订单详情
                if (isOrderMsg) {
                  const role = useAuthStore.getState().user?.role;
                  if (role === 'merchant' || role === 'admin') {
                    // 取消申请优先落到退款售后心智；新支付单进商家首页待接单
                    Taro.switchTab({ url: '/pages/admin/index' });
                    return;
                  }
                  if (item.relatedId) {
                    Taro.navigateTo({
                      url: `/pages/order-detail/index?orderId=${item.relatedId}`,
                    });
                  }
                }
              }}
            >
              <View className='notif-page__item-head'>
                <Text className='notif-page__title'>{item.title}</Text>
                {readPending ? (
                  <Text className='notif-page__marking'>标记中...</Text>
                ) : null}
                {!item.isRead && !readPending && <View className='notif-page__dot' />}
              </View>
              <Text className='notif-page__content'>{item.content}</Text>
              <Text className='notif-page__time'>{formatRelativeTime(item.createdAt)}</Text>
            </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
