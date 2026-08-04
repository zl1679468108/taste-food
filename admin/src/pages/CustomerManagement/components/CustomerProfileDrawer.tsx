import React, { useState } from 'react';
import {
  Drawer,
  Descriptions,
  Tag,
  Space,
  Avatar,
  Typography,
  Skeleton,
  Empty,
  Statistic,
  List,
  Button,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  ShoppingOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  TagsOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { ShopCustomerProfile } from '@/services/customer';
import { useCustomerTags } from '@/hooks/queries/useCustomerQueries';
import { formatTime, shortOrderId } from '@/utils/format';
import { formatPrice } from '@/utils/format';
import { brand } from '@/theme';
import OrderStatusTag from '@/components/OrderStatusTag';
import TagAssignModal from './TagAssignModal';
import MessageModal from './MessageModal';

const { Text, Paragraph } = Typography;

const statusMap: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '正常' },
  disabled: { color: 'red', text: '已禁用' },
  banned: { color: 'volcano', text: '已拉黑' },
};

export interface CustomerProfileDrawerProps {
  profileId?: string;
  open: boolean;
  onClose: () => void;
  profile?: ShopCustomerProfile;
  loading?: boolean;
}

const CustomerProfileDrawer: React.FC<CustomerProfileDrawerProps> = ({
  profileId,
  open,
  onClose,
  profile,
  loading,
}) => {
  const { data: tags = [] } = useCustomerTags(profileId);
  const [tagAssignOpen, setTagAssignOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      destroyOnHidden
      title={
        <Space>
          <TeamOutlined style={{ color: brand.primary }} />
          <span>顾客详情</span>
        </Space>
      }
      extra={
        <Space>
          <Button
            size="small"
            icon={<TagsOutlined />}
            onClick={() => setTagAssignOpen(true)}
          >
            管理标签
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<MessageOutlined />}
            onClick={() => setMessageOpen(true)}
          >
            发送站内信
          </Button>
        </Space>
      }
    >
      {loading || !profile ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 头部：头像 + 昵称 + 状态 */}
          <Space size={16} align="start" style={{ width: '100%' }}>
            <Avatar
              src={profile.avatarUrl}
              icon={<UserOutlined />}
              size={56}
              style={{ backgroundColor: brand.primary, flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Space size={8} wrap>
                <Text strong style={{ fontSize: 18 }}>
                  {profile.nickName || '未命名用户'}
                </Text>
                <Tag color={(statusMap[profile.status || 'active'] || statusMap.active).color}>
                  {(statusMap[profile.status || 'active'] || statusMap.active).text}
                </Tag>
              </Space>
              <div style={{ marginTop: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ID {profile.id.slice(0, 8)}…
                </Text>
              </div>
            </div>
          </Space>

          {/* 标签 */}
          <div>
            <Text strong>
              <TagsOutlined style={{ marginRight: 6 }} />
              标签
            </Text>
            <div style={{ marginTop: 8 }}>
              {tags.length ? (
                <Space size={[6, 6]} wrap>
                  {tags.map((t) => (
                    <Tag key={t.id} color={t.color}>
                      {t.name}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">尚未打标签</Text>
              )}
            </div>
          </div>

          {/* 基本资料 */}
          <Descriptions
            title={<Text strong>基本资料</Text>}
            column={1}
            size="small"
            bordered
            styles={{ label: { width: 100 } }}
          >
            <Descriptions.Item label="手机号">
              {profile.phone ? (
                <Text copyable={{ text: profile.phone, tooltips: ['复制手机号', '已复制'] }}>
                  {profile.phone}
                </Text>
              ) : (
                <Text type="secondary">未填写</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {formatTime(profile.registerDate, 'YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="最后登录">
              {profile.lastLoginAt ? (
                formatTime(profile.lastLoginAt, 'YYYY-MM-DD HH:mm:ss')
              ) : (
                <Text type="secondary">从未登录</Text>
              )}
            </Descriptions.Item>
          </Descriptions>

          {/* 本店业务画像 */}
          <div>
            <Text strong>
              <ShoppingOutlined style={{ marginRight: 6 }} />
              本店消费画像
            </Text>
            <div
              style={{
                marginTop: 12,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 16,
              }}
            >
              <Statistic
                title="本店订单数"
                value={profile.stats.orderCount ?? 0}
                prefix={<ShoppingOutlined style={{ color: brand.primary }} />}
                valueStyle={{ fontSize: 20 }}
              />
              <Statistic
                title="本店累计消费"
                value={formatPrice(profile.stats.totalSpent ?? 0)}
                valueStyle={{ fontSize: 20, color: brand.textPrice }}
              />
              <Statistic
                title="客单价"
                value={formatPrice(profile.stats.avgOrderValue ?? 0)}
                prefix={<RiseOutlined style={{ color: brand.primary }} />}
                valueStyle={{ fontSize: 20 }}
              />
              <div>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  最近下单
                </Text>
                <div style={{ marginTop: 6 }}>
                  {profile.stats.lastOrderAt ? (
                    <Text>
                      <ClockCircleOutlined style={{ marginRight: 4, color: brand.primary }} />
                      {formatTime(profile.stats.lastOrderAt, 'YYYY-MM-DD HH:mm')}
                    </Text>
                  ) : (
                    <Text type="secondary">暂无</Text>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 本店最近订单 */}
          <div>
            <Text strong>本店最近订单</Text>
            <div style={{ marginTop: 12 }}>
              {profile.recentOrders && profile.recentOrders.length > 0 ? (
                <List
                  size="small"
                  bordered
                  dataSource={profile.recentOrders}
                  renderItem={(o) => (
                    <List.Item>
                      <div style={{ width: '100%' }}>
                        <Space size={8} wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                          <Space size={8} wrap>
                            <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>
                              {o.orderNo || shortOrderId(o.id)}
                            </Text>
                            <OrderStatusTag status={o.status} />
                          </Space>
                          <Text strong style={{ color: brand.textPrice }}>
                            {formatPrice(o.total)}
                          </Text>
                        </Space>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {formatTime(o.createdAt, 'YYYY-MM-DD HH:mm')}
                            {o.itemCount ? ` · 共 ${o.itemCount} 件` : ''}
                          </Text>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="该顾客在本店暂无订单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </div>

          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            数据为「本店」维度（仅统计该顾客在当前店铺的订单）。
          </Paragraph>
        </Space>
      )}

      <TagAssignModal
        open={tagAssignOpen}
        onClose={() => setTagAssignOpen(false)}
        customerId={profileId}
        customerName={profile?.nickName}
      />
      <MessageModal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        customerId={profileId}
        customerName={profile?.nickName}
      />
    </Drawer>
  );
};

export default CustomerProfileDrawer;
