import React from 'react';
import {
  Drawer,
  Descriptions,
  Tag,
  Space,
  Avatar,
  Typography,
  Skeleton,
  Empty,
  Divider,
  Statistic,
  Button,
  Timeline,
} from 'antd';
import {
  UserOutlined,
  CopyOutlined,
  TeamOutlined,
  CompassOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  ShoppingOutlined,
  StarOutlined,
  CrownOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ShopOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import { UserProfile } from '@/services/user';
import { antdMessage as message } from '@/utils/antdApp';
import { formatTime } from '@/utils/format';
import { brand } from '@/theme';

const { Text, Paragraph } = Typography;

const statusMap: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '正常' },
  disabled: { color: 'red', text: '已禁用' },
  banned: { color: 'volcano', text: '已拉黑' },
};

const roleMap: Record<string, { color: string; text: string }> = {
  customer: { color: 'blue', text: '顾客' },
  admin: { color: 'red', text: '平台管理员' },
  merchant: { color: 'orange', text: '商家' },
  rider: { color: 'green', text: '骑手' },
};

function resolveRoleLabel(role: string, shopId?: string): string {
  if (role === 'admin') return shopId ? '商家(兼容)' : '平台管理员';
  return roleMap[role]?.text || role || '-';
}

/** 头像兜底：默认色用 brand.primary */
function ProfileAvatar({ url, size = 56 }: { url?: string; size?: number }) {
  return (
    <Avatar
      src={url}
      icon={<UserOutlined />}
      size={size}
      style={{ backgroundColor: brand.primary, flexShrink: 0 }}
    />
  );
}

/** 复制按钮封装：复制成功提示 */
function CopyableText({ text, label }: { text?: string; label?: string }) {
  if (!text) return <Text type="secondary">-</Text>;
  return (
    <Space size={4}>
      <Text copyable={{ text, tooltips: [`复制${label || ''}`, '已复制'] }} style={{ fontFamily: 'monospace' }}>
        {text}
      </Text>
    </Space>
  );
}

/** 顾客画像卡 */
function CustomerStatsCard({ stats, onJumpToOrders }: { stats: UserProfile['stats']; onJumpToOrders?: () => void }) {
  return (
    <div className="tf-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <Statistic
        title="订单数"
        value={stats.orderCount ?? 0}
        prefix={<ShoppingOutlined style={{ color: brand.primary }} />}
        valueStyle={{ fontSize: 20 }}
      />
      <Statistic
        title="累计消费"
        value={((stats.totalSpent ?? 0) / 100).toFixed(2)}
        prefix="¥"
        valueStyle={{ fontSize: 20, color: brand.textPrice }}
      />
      <Statistic
        title="收藏菜品"
        value={stats.favoriteCount ?? 0}
        prefix={<StarOutlined style={{ color: brand.primary }} />}
        valueStyle={{ fontSize: 20 }}
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <Space size={8} wrap>
          <Text type="secondary">最近下单：</Text>
          {stats.lastOrderAt ? (
            <>
              <Text>{formatTime(stats.lastOrderAt, 'YYYY-MM-DD HH:mm')}</Text>
              {onJumpToOrders ? (
                <Button type="link" size="small" onClick={onJumpToOrders}>
                  查看该用户订单
                </Button>
              ) : null}
            </>
          ) : (
            <Text type="secondary">暂无</Text>
          )}
        </Space>
      </div>
    </div>
  );
}

/** 商家画像卡 */
function MerchantStatsCard({ stats, shopName }: { stats: UserProfile['stats']; shopName?: string }) {
  const shopStatusText = stats.shopStatus === 'open' ? '营业中' : stats.shopStatus === 'closed' ? '已关店' : '-';
  const shopStatusColor = stats.shopStatus === 'open' ? 'green' : stats.shopStatus === 'closed' ? 'default' : 'default';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <Statistic
        title="店铺"
        value={shopName || '-'}
        prefix={<ShopOutlined style={{ color: brand.primary }} />}
        valueStyle={{ fontSize: 16 }}
      />
      <Statistic
        title="店铺状态"
        valueRender={() => <Tag color={shopStatusColor}>{shopStatusText}</Tag>}
      />
      <Statistic
        title="本店历史订单"
        value={stats.shopTotalOrders ?? 0}
        prefix={<ShoppingOutlined style={{ color: brand.primary }} />}
        valueStyle={{ fontSize: 20 }}
      />
      <Statistic
        title="本店近 30 天订单"
        value={stats.shopRecent30dOrders ?? 0}
        prefix={<ClockCircleOutlined style={{ color: brand.primary }} />}
        valueStyle={{ fontSize: 20 }}
      />
    </div>
  );
}

/** 骑手画像卡 */
function RiderStatsCard({ stats }: { stats: UserProfile['stats'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <Statistic
        title="累计完成订单"
        value={stats.completedOrders ?? 0}
        prefix={<CheckCircleOutlined style={{ color: brand.primary }} />}
        valueStyle={{ fontSize: 20 }}
      />
      <Statistic
        title="当前配送中"
        value={stats.deliveringOrders ?? 0}
        prefix={<CompassOutlined style={{ color: brand.primary }} />}
        valueStyle={{ fontSize: 20 }}
      />
      <Statistic
        title="平均评分"
        value={stats.avgRating?.toFixed(1) ?? '-'}
        prefix={<StarOutlined style={{ color: '#faad14' }} />}
        valueStyle={{ fontSize: 20 }}
        suffix={stats.avgRating ? '/ 5' : undefined}
      />
    </div>
  );
}

/** 管理员画像卡 */
function AdminStatsCard({ stats }: { stats: UserProfile['stats'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <Statistic
        title="今日全平台订单"
        value={stats.platformOrdersToday ?? 0}
        prefix={<CrownOutlined style={{ color: brand.primary }} />}
        valueStyle={{ fontSize: 20 }}
      />
    </div>
  );
}

/** 头像 + 昵称 + 角色 tag 头部 */
function ProfileHeader({ profile }: { profile: UserProfile }) {
  const role = profile.role;
  const statusInfo = statusMap[profile.status || 'active'] || statusMap.active;
  return (
    <Space size={16} align="start" style={{ width: '100%' }}>
      <ProfileAvatar url={profile.avatarUrl} size={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Space size={8} wrap>
          <Text strong style={{ fontSize: 18 }}>{profile.nickName || '未命名用户'}</Text>
          <Tag color={roleMap[role]?.color}>{resolveRoleLabel(role, profile.shopId)}</Tag>
          <Tag color={statusInfo.color} icon={profile.status === 'disabled' ? <StopOutlined /> : <CheckCircleOutlined />}>
            {statusInfo.text}
          </Tag>
        </Space>
        <div style={{ marginTop: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ID {profile.id.slice(0, 8)}…
            <CopyOutlined
              style={{ marginLeft: 6, cursor: 'pointer' }}
              onClick={() => {
                navigator.clipboard?.writeText(profile.id);
                message.success('ID 已复制');
              }}
            />
          </Text>
        </div>
      </div>
    </Space>
  );
}

export interface UserProfileDrawerProps {
  userId?: string;
  open: boolean;
  onClose: () => void;
  profile?: UserProfile;
  loading?: boolean;
  shopName?: string;
}

const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({
  userId,
  open,
  onClose,
  profile,
  loading,
  shopName,
}) => {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      destroyOnHidden
      title={
        <Space>
          <TeamOutlined style={{ color: brand.primary }} />
          <span>用户详情</span>
        </Space>
      }
    >
      {loading || !profile ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <ProfileHeader profile={profile} />

          <Descriptions
            title={<Text strong>基本资料</Text>}
            column={1}
            size="small"
            bordered
            styles={{ label: { width: 100 } }}
          >
            <Descriptions.Item label="昵称">{profile.nickName || '-'}</Descriptions.Item>
            <Descriptions.Item label="OpenID">
              <CopyableText text={profile.openid} label="OpenID" />
            </Descriptions.Item>
            <Descriptions.Item label="手机号">
              {profile.phone ? (
                <Text copyable={{ text: profile.phone, tooltips: ['复制手机号', '已复制'] }}>
                  {profile.phone}
                </Text>
              ) : (
                <Text type="secondary">未填写</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="所属店铺">{shopName || '-'}</Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {formatTime(profile.registerDate || profile.createdAt, 'YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="最后登录">
              {profile.lastLoginAt ? formatTime(profile.lastLoginAt, 'YYYY-MM-DD HH:mm:ss') : <Text type="secondary">从未登录</Text>}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Text strong>角色</Text>
            <div style={{ marginTop: 8 }}>
              {profile.roles && profile.roles.length > 0 ? (
                <Space wrap>
                  {profile.roles.map((r, i) => {
                    const isActive = r.role === profile.role;
                    const color = r.status === 'active' ? roleMap[r.role]?.color || 'default' : 'default';
                    return (
                      <Tag
                        key={`${r.role}-${i}`}
                        color={color}
                        style={isActive ? { fontWeight: 600 } : undefined}
                      >
                        {resolveRoleLabel(r.role, r.shopId)}
                        {isActive ? ' (当前)' : ''}
                        {r.status !== 'active' ? ` · ${r.status}` : ''}
                      </Tag>
                    );
                  })}
                </Space>
              ) : (
                <Text type="secondary">无角色记录</Text>
              )}
            </div>
          </div>

          <Divider style={{ margin: '4px 0' }} />

          <div>
            <Text strong>
              <FileSearchOutlined style={{ marginRight: 6 }} />
              业务画像
            </Text>
            <div style={{ marginTop: 12 }}>
              {profile.role === 'customer' && (
                <CustomerStatsCard
                  stats={profile.stats}
                  onJumpToOrders={() => {
                    // T312.6：跳到订单页并按 userId 过滤
                    history.push(`/merchant/orders?userId=${profile.id}`);
                  }}
                />
              )}
              {profile.role === 'merchant' && (
                <MerchantStatsCard stats={profile.stats} shopName={shopName} />
              )}
              {profile.role === 'rider' && (
                <RiderStatsCard stats={profile.stats} />
              )}
              {profile.role === 'admin' && (
                <AdminStatsCard stats={profile.stats} />
              )}
            </div>
          </div>

          <Divider style={{ margin: '4px 0' }} />

          <div>
            <Text strong>
              <AuditOutlined style={{ marginRight: 6 }} />
              近期审计（近 5 条）
            </Text>
            <div style={{ marginTop: 12 }}>
              {profile.recentAudits && profile.recentAudits.length > 0 ? (
                <Timeline
                  items={profile.recentAudits.map((a) => ({
                    color: a.statusCode && a.statusCode >= 400 ? 'red' : 'green',
                    children: (
                      <div>
                        <Space size={6} wrap>
                          <Tag>{a.action || a.method}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {a.method} {a.path}
                          </Text>
                        </Space>
                        <Paragraph style={{ margin: '4px 0 0 0', fontSize: 13 }}>
                          {a.summary}
                        </Paragraph>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatTime(a.createdAt, 'YYYY-MM-DD HH:mm:ss')}
                          {a.statusCode ? ` · HTTP ${a.statusCode}` : ''}
                        </Text>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Empty description="暂无审计记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </div>
        </Space>
      )}
    </Drawer>
  );
};

export default UserProfileDrawer;
