import React from 'react';
import { Card, Skeleton, Tooltip } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import { brand } from '@/theme';
import { calcTrend, type TrendDirection } from './trend';

export { calcTrend } from './trend';
export type { TrendDirection, TrendResult } from './trend';

export interface DashboardStatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon: React.ReactNode;
  color?: string;
  bgColor?: string;
  /** 本期数值（用于环比计算，与 value 的展示格式无关） */
  current?: number;
  /** 上一等长期数值 */
  previous?: number;
  /** 环比说明，如「较昨日」「较上一周期」 */
  compareLabel?: string;
  /** 鼠标悬浮补充说明，如基期具体数值 */
  compareTip?: string;
  loading?: boolean;
}

/** 中国习惯：涨红跌绿 */
function trendColor(direction: TrendDirection): string {
  if (direction === 'up') return brand.danger;
  if (direction === 'down') return brand.success;
  return brand.textSecondary;
}

function TrendIcon({ direction }: { direction: TrendDirection }) {
  if (direction === 'up') return <ArrowUpOutlined />;
  if (direction === 'down') return <ArrowDownOutlined />;
  return <MinusOutlined />;
}

const DashboardStatCard: React.FC<DashboardStatCardProps> = ({
  title,
  value,
  suffix,
  icon,
  color = brand.primary,
  bgColor = brand.primaryLight,
  current,
  previous,
  compareLabel,
  compareTip,
  loading = false,
}) => {
  const showTrend = current !== undefined && previous !== undefined;
  const trend = showTrend ? calcTrend(current, previous) : null;

  const trendNode = trend ? (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--tf-space-1)',
        color: trendColor(trend.direction),
        fontWeight: 600,
      }}
    >
      <TrendIcon direction={trend.direction} />
      {trend.text}
    </span>
  ) : null;

  return (
    <Card variant="borderless" style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--tf-space-4)',
          }}
        >
          <div
            style={{
              color,
              backgroundColor: bgColor,
              width: 48,
              height: 48,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: brand.textSecondary,
                fontSize: 'var(--tf-font-sm)',
                lineHeight: 'var(--tf-leading-normal, 1.5)',
                marginBottom: 'var(--tf-space-1)',
              }}
            >
              {title}
            </div>
            <div
              style={{
                color: brand.textPrimary,
                fontSize: 'var(--tf-font-5xl)',
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {value}
              {suffix ? (
                <span
                  style={{
                    fontSize: 'var(--tf-font-base)',
                    marginLeft: 'var(--tf-space-1)',
                    fontWeight: 500,
                  }}
                >
                  {suffix}
                </span>
              ) : null}
            </div>
            <div
              style={{
                minHeight: 'var(--tf-space-5)',
                marginTop: 'var(--tf-space-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--tf-space-1)',
                fontSize: 'var(--tf-font-xs)',
                color: brand.textSecondary,
              }}
            >
              {compareTip && trendNode ? (
                <Tooltip title={compareTip}>{trendNode}</Tooltip>
              ) : (
                trendNode
              )}
              {trendNode && compareLabel ? <span>{compareLabel}</span> : null}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default DashboardStatCard;
