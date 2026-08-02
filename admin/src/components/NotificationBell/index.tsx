import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Dropdown, Empty, List, Spin, Typography, notification as antdNotification } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { useQueryClient } from '@tanstack/react-query';
import { listNotifications, type InboxNotification } from '@/services/notification';
import {
  useMarkNotificationRead,
  useUnreadCount,
  queryKeys,
} from '@/hooks/queries';
import {
  connectSocket,
  disconnectSocket,
  offNotificationNew,
  offSocketReconnect,
  onNotificationNew,
  onSocketReconnect,
  type NotificationNewEvent,
} from '@/services/socket';
import { formatTime } from '@/utils/format';
import { playAdminOrderAlert, shouldPlayOrderAlert } from '@/utils/orderAlertSound';
import { brand } from '@/theme';

const { Text } = Typography;

/** 订单类消息跳转订单详情；其余进消息中心页面（/messages） */
export function resolveNotificationPath(item: Pick<InboxNotification, 'type' | 'relatedType' | 'relatedId'>): string {
  const isOrder =
    item.relatedType === 'order' ||
    item.type === 'order_paid' ||
    item.type === 'order_cancel_request' ||
    item.type === 'order_cancel_approved' ||
    item.type === 'order_cancel_rejected';
  if (isOrder && item.relatedId) {
    return `/order?orderId=${encodeURIComponent(item.relatedId)}`;
  }
  if (isOrder) return '/merchant/order';
  return '/messages';
}

/** 顶栏消息铃铛：未读数 + 最近消息预览 + 新单音效 */
const NotificationBell: React.FC = () => {
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [readingId, setReadingId] = useState<string | null>(null);

  const { data: unreadCountData, refetch: refetchUnreadCount } = useUnreadCount();
  const count = unreadCountData?.count ?? 0;
  const markReadMutation = useMarkNotificationRead();
  const queryClient = useQueryClient();

  const refreshCount = useCallback(() => {
    void refetchUnreadCount();
  }, [refetchUnreadCount]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listNotifications(1, 8);
      setItems(res?.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleIncoming = useCallback((n: NotificationNewEvent) => {
    // 服务端带了权威未读数则直接写入 React Query 缓存，避免一次网络请求
    if (typeof n.unreadCount === 'number') {
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), { count: Math.max(0, n.unreadCount) });
    } else {
      void refetchUnreadCount();
    }
    setItems((preview) => {
      const exists = preview.some((item) => item.id === n.id);
      if (exists) return preview;
      return [n, ...preview].slice(0, 8);
    });

    if (shouldPlayOrderAlert(n.type)) {
      playAdminOrderAlert(n.type);
      antdNotification.open({
        message: n.title,
        description: n.content,
        placement: 'topRight',
        duration: 6,
        onClick: () => {
          history.push(resolveNotificationPath(n));
        },
      });
    }
  }, [queryClient, refetchUnreadCount]);

  useEffect(() => {
    // 复用全局那条 /orders 连接（引用计数），不新建独立 socket
    connectSocket();
    onNotificationNew(handleIncoming);
    // 断线重连后推送有缺口，重新拉一次未读数对齐
    onSocketReconnect(refreshCount);
    void refreshCount();

    return () => {
      offNotificationNew(handleIncoming);
      offSocketReconnect(refreshCount);
      // 放在最后：引用计数归零时会清空所有回调集合，先解绑再释放引用
      disconnectSocket();
    };
  }, [handleIncoming, refreshCount]);

  useEffect(() => {
    if (open) {
      void loadPreview();
      void refreshCount();
    }
  }, [open, loadPreview, refreshCount]);

  const handleItemClick = async (item: InboxNotification) => {
    if (!item.isRead && readingId !== item.id) {
      setReadingId(item.id);
      try {
        await markReadMutation.mutateAsync(item.id);
        setItems((preview) => preview.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      } catch {
        // ignore
      } finally {
        setReadingId(null);
      }
    }
    setOpen(false);
    history.push(resolveNotificationPath(item));
  };

  const menu = useMemo(
    () => (
      <div
        style={{
          width: 340,
          background: brand.bgCard,
          borderRadius: 8,
          boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
          padding: 'var(--tf-space-2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--tf-space-1) var(--tf-space-2) var(--tf-space-2)',
          }}
        >
          <Text strong>消息</Text>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setOpen(false);
              history.push('/messages');
            }}
          >
            查看全部
          </Button>
        </div>
        <Spin spinning={loading}>
          {items.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无消息" />
          ) : (
            <List
              size="small"
              dataSource={items}
              renderItem={(item) => (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    background: item.isRead ? 'transparent' : brand.primaryLight,
                    borderRadius: 6,
                    padding: 'var(--tf-space-2) var(--tf-space-2_5)',
                  }}
                  onClick={() => void handleItemClick(item)}
                >
                  <List.Item.Meta
                    title={
                      <Text strong={!item.isRead} style={{ fontSize: 13 }}>
                        {item.title}
                      </Text>
                    }
                    description={
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                          {item.content}
                        </Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {formatTime(item.createdAt)}
                          </Text>
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>
      </div>
    ),
    [items, loading],
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      popupRender={() => menu}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={count} size="small" offset={[-2, 4]}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 18, color: brand.textSecondary }} />}
          style={{ width: 36, height: 36 }}
          aria-label="消息通知"
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBell;
