import React, { useCallback, useEffect, useState } from 'react';
import { Button, List, Space, Tag, Typography, Empty, Spin, message } from 'antd';
import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type InboxNotification,
} from '@/services/notification';
import { formatTime } from '@/utils/format';
import { brand } from '@/theme';
import TableCard from '@/components/TableCard';

const { Title, Text, Paragraph } = Typography;

const MessagesPage: React.FC = () => {
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const res = await listNotifications(p, 20);
      setItems(res?.items || []);
      setTotal(res?.total || 0);
      setPage(res?.page || p);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load(1);
  }, []);

  const handleRead = async (item: InboxNotification) => {
    if (item.isRead) return;
    try {
      await markNotificationRead(item.id);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      );
    } catch {
      // toast
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      message.success('已全部标为已读');
      await load(page);
    } catch {
      // toast
    }
  };

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            消息中心
          </Title>
          <Text type="secondary">共 {total} 条消息</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load(page)}>
            刷新
          </Button>
          <Button type="primary" icon={<CheckOutlined />} onClick={() => void handleReadAll()}>
            全部已读
          </Button>
        </Space>
      </Space>

      <TableCard>
        <Spin spinning={loading}>
          {items.length === 0 ? (
            <Empty description="暂无消息" style={{ padding: 48 }} />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={items}
              renderItem={(item) => (
                <List.Item
                  key={item.id}
                  style={{
                    background: item.isRead ? 'transparent' : brand.primaryLight || '#FFF8F0',
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 8,
                    cursor: item.isRead ? 'default' : 'pointer',
                  }}
                  onClick={() => void handleRead(item)}
                  actions={[
                    !item.isRead ? (
                      <Button
                        key="read"
                        type="link"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRead(item);
                        }}
                      >
                        标为已读
                      </Button>
                    ) : (
                      <Text key="done" type="secondary" style={{ fontSize: 12 }}>
                        已读
                      </Text>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.title}</span>
                        {!item.isRead && <Tag color="orange">未读</Tag>}
                      </Space>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatTime(item.createdAt)}
                      </Text>
                    }
                  />
                  <Paragraph style={{ marginBottom: 0 }}>{item.content}</Paragraph>
                </List.Item>
              )}
            />
          )}
        </Spin>
      </TableCard>
    </div>
  );
};

export default MessagesPage;
