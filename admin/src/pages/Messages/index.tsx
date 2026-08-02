import React, { useState } from 'react';
import { Button, List, Space, Tag, Typography, Empty, Spin } from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { type InboxNotification } from '@/services/notification';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/queries';
import { useKeywordFilter } from '@/hooks/useKeywordFilter';
import { formatTime } from '@/utils/format';
import { brand } from '@/theme';
import TableCard from '@/components/TableCard';
import PageHeaderActions from '@/components/PageHeaderActions';
import SearchFilterBar from '@/components/SearchFilterBar';

const { Text, Paragraph } = Typography;

// 消息中心数据量小，一次性拉全量后在本地过滤（避免分页导致的"只能看第 1 页"问题）
const MESSAGES_PAGE_SIZE = 1000;

const MessagesPage: React.FC = () => {
  const [keyword, setKeyword] = useState('');

  const notificationsQuery = useNotifications(1, MESSAGES_PAGE_SIZE);
  const allItems = notificationsQuery.data?.items ?? [];
  const loading = notificationsQuery.isPending;

  const items = useKeywordFilter(allItems, keyword, ['title', 'content']);

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  /**
   * 已发起标已读的消息 id 集合。
   * item.isRead 依赖 refetch 后的数据，失效前可被重复点击，故用本地集合按行守卫。
   */
  const [readingIds, setReadingIds] = useState<Set<string>>(new Set());

  const handleRead = async (item: InboxNotification) => {
    if (item.isRead || readingIds.has(item.id)) return;
    setReadingIds((prev) => new Set(prev).add(item.id));
    try {
      await markReadMutation.mutateAsync(item.id);
    } catch {
      // toast
    } finally {
      setReadingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleReadAll = async () => {
    if (markAllReadMutation.isPending) return;
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
        icon={<BellOutlined style={{ marginRight: 'var(--tf-space-2)'}} />}
        title="消息中心"
        onRefresh={() => void notificationsQuery.refetch()}
        extra={
          <Button
            type="primary"
            icon={<CheckOutlined />}
            loading={markAllReadMutation.isPending}
            disabled={markAllReadMutation.isPending}
            onClick={() => void handleReadAll()}
          >
            全部已读
          </Button>
        }
      />

      <TableCard
        title="站内消息"
        extra={<Text type="secondary">共 {items.length} 条</Text>}
      >
        <SearchFilterBar
          searchPlaceholder="搜索消息标题/内容"
          onSearch={setKeyword}
          onSearchClear={() => setKeyword('')}
        />
        <Spin spinning={loading}>
          {items.length === 0 ? (
            <Empty description="暂无消息" style={{ padding: 'var(--tf-space-12)'}} />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={items}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
                showTotal: (t) => `共 ${t} 条`,
              }}
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
                        loading={readingIds.has(item.id)}
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
