import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Dropdown, Empty, List, Spin, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import {
  getUnreadCount,
  listNotifications,
  markNotificationRead,
  type InboxNotification,
} from '@/services/notification';
import { formatTime } from '@/utils/format';
import { brand } from '@/theme';

const { Text } = Typography;

/**
 * 顶栏消息铃铛：未读数 + 最近消息预览
 */
const NotificationBell: React.FC = () => {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      setCount(res?.count || 0);
    } catch {
      // silent
    }
  }, []);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listNotifications(1, 5);
      setItems(res?.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const timer = window.setInterval(() => {
      void refreshCount();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [refreshCount]);

  useEffect(() => {
    if (open) {
      void loadPreview();
      void refreshCount();
    }
  }, [open, loadPreview, refreshCount]);

  const handleItemClick = async (item: InboxNotification) => {
    if (!item.isRead) {
      try {
        await markNotificationRead(item.id);
        setCount((c) => Math.max(0, c - 1));
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
        );
      } catch {
        // ignore
      }
    }
    setOpen(false);
    history.push('/messages');
  };

  const menu = (
    <div
      style={{
        width: 320,
        background: brand.bgCard,
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
        padding: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 8px 8px',
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
                  padding: '8px 10px',
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
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => menu}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={count} size="small" offset={[-2, 2]}>
        <Button type="text" icon={<BellOutlined style={{ fontSize: 16 }} />} />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBell;
