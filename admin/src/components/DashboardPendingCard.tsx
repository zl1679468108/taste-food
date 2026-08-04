import React from 'react';
import { Card, Skeleton, Space } from 'antd';
import { ClockCircleOutlined, RightOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { brand } from '@/theme';
import type { PendingStats } from '@/services/order';

interface DashboardPendingCardProps {
  /** 待处理聚合数据（不限时间维度） */
  stats: PendingStats;
  loading?: boolean;
  /**
   * 是否可点击跳转。仅商家角色（canMerchant）为 true——
   * 平台管理员无订单管理页，置为 false 时仅展示数量、不可跳转。
   */
  clickable?: boolean;
}

/** 订单管理页路径（商家端，带 status 查询参数即预筛选对应待办） */
const ORDER_PATH = '/merchant/order';

const SUB_ITEMS = [
  { key: 'paid', label: '待接单', hint: '已支付 · 待接单' },
  { key: 'accepted', label: '待备餐', hint: '已接单 · 待备餐' },
] as const;

/**
 * Dashboard 顶部常驻「待处理」区。
 *
 * 与下方「订单数 / 营收」不同，它**不受时间范围控件影响**，
 * 始终展示所有未处理积压（paid + accepted），方便商家一眼看到待办并跳转处理。
 */
const DashboardPendingCard: React.FC<DashboardPendingCardProps> = ({
  stats,
  loading,
  clickable = false,
}) => {
  const go = (status: string) => {
    if (!clickable) return;
    history.push(`${ORDER_PATH}?status=${status}`);
  };

  return (
    <Card
      variant="borderless"
      style={{
        borderRadius: brand.radius,
        boxShadow: brand.shadow,
        marginBottom: 'var(--tf-space-6)',
        borderLeft: `4px solid ${brand.warning}`,
      }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} title={false} />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--tf-space-4)',
          }}
        >
          {/* 左：标题 + 总待处理数 */}
          <Space size="middle" align="center">
            <ClockCircleOutlined style={{ fontSize: 28, color: brand.warning }} />
            <div>
              <div style={{ fontSize: 13, color: brand.textSecondary }}>当前待处理</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: brand.warning, lineHeight: 1.2 }}>
                {stats.total}
                <span style={{ fontSize: 13, fontWeight: 400, color: brand.textTertiary, marginLeft: 4 }}>
                  单
                </span>
              </div>
            </div>
          </Space>

          {/* 右：可点击的子项（待接单 / 待备餐） */}
          <Space size="large" wrap>
            {SUB_ITEMS.map((item) => {
              const count = item.key === 'paid' ? stats.paid : stats.accepted;
              return (
                <div
                  key={item.key}
                  onClick={() => go(item.key)}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      go(item.key);
                    }
                  }}
                  style={{
                    cursor: clickable ? 'pointer' : 'default',
                    padding: 'var(--tf-space-2) var(--tf-space-4)',
                    borderRadius: brand.radius,
                    background: brand.bgMuted,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (clickable) e.currentTarget.style.background = brand.warningSoft;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = brand.bgMuted;
                  }}
                >
                  <div style={{ fontSize: 13, color: brand.textSecondary }}>{item.label}</div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 18,
                      fontWeight: 600,
                      color: count > 0 ? brand.warning : brand.textTertiary,
                    }}
                  >
                    {count}
                    {clickable && count > 0 && (
                      <RightOutlined style={{ fontSize: 12, color: brand.textHint }} />
                    )}
                  </div>
                </div>
              );
            })}
          </Space>
        </div>
      )}
    </Card>
  );
};

export default DashboardPendingCard;
