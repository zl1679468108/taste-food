import React, { useState } from 'react';
import { Button, List, Space, Tag, Typography, Empty, Spin, message } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { type InboxNotification } from '@/services/notification';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/queries';
import { formatTime } from '@/utils/format';
import { brand } from '@/theme';
import TableCard from '@/components/TableCard';
import PageHeaderActions from '@/components/PageHeaderActions';

const { Text, Paragraph } = Typography;

const MessagesPage: React.FC = () => {
  const [page, setPage] = useState(1);

  const notificationsQuery = useNotifications(page, 20);
  const items = notificationsQuery.data?.items ?? [];
  const total = notificationsQuery.data?.total ?? 0;
  const loading = notificationsQuery.isPending;

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const handleRead = async (item: InboxNotification) => {
    if (item.isRead) return;
    try {
      await markReadMutation.mutateAsync(item.id);
    } catch {
      // toast
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllReadMutation.mutateAsync();
      message.success('已全部标为已读');
    } catch {
      // toast
    }
  };

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<BellOutlined style={{ marginRight: 8 }} />}
        title="消息中心"
        onRefresh={() => void notificationsQuery.refetch()}
        extra={
          <Button type="primary" icon={<CheckOutlined />} onClick={() => void handleReadAll()}>
            全部已读
          </Button>
        }
      />

      <TableCard
        title="站内消息"
        extra={<Text type="secondary">共 {total} 条</Text>}
      >
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
                    background: item.isRead ? brand.bgCard : brand.primaryLight,
                    border: `1px solid ${item.isRead ? brand.border : brand.primaryLight}`,
                    borderRadius: brand.radius,
                    padding: `${brand.space3}px ${brand.space4}px`,
                    marginBottom: brand.space2,
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
                  <Paragraph style={{ marginBottom: 0, color: brand.textPrimary }}>
                    {item.content}
                  </Paragraph>
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
