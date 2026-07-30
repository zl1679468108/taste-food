import React, { useState } from 'react';
import { Card, Col, Row, Space, Spin, Segmented, DatePicker } from 'antd';
import dayjs from 'dayjs';
import {
ShoppingCartOutlined,
MoneyCollectOutlined,
ClockCircleOutlined,
CheckCircleOutlined,
RiseOutlined,
LineChartOutlined,
PieChartOutlined,
} from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import { DailyStatsItem as ApiDailyStatsItem, DailyStatsItem, StatusDistributionItem } from '@/services/order';
import { formatPrice } from '@/utils/format';
import StatisticCard from '@/components/StatisticCard';
import PageHeaderActions from '@/components/PageHeaderActions';
import { useShopContext } from '@/hooks/useShopContext';
import { brand } from '@/theme';
import {
useOrderStatsToday,
useDailyStats,
useStatusDistribution,
} from '@/hooks/queries';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/hooks/queries/queryKeys';
import { message } from 'antd';
import { useEffect } from 'react';

const { RangePicker } = DatePicker;

type RangeKey = '1' | '7' | '30' | 'custom' | 'all';

const RANGE_OPTIONS = [
{ label: '今日', value: '1' },
{ label: '近7天', value: '7' },
{ label: '近30天', value: '30' },
{ label: '自定义', value: 'custom' },
];

const ALL_SHOPS_RANGE_OPTION = { label: '全店汇总', value: 'all' } as const;

const STATUS_TEXT: Record<string, string> = {
  completed: '已完成',
  delivering: '配送中',
  preparing: '制作中',
  paid: '已支付',
  accepted: '已接单',
  pending_payment: '待支付',
  cancelled: '已取消',
  rejected: '已拒绝',
  ready_for_pickup: '待取餐',
};

function getStatusText(status: string): string {
  return STATUS_TEXT[status] || status;
}

// TODO: 待后端增加 dateRange 参数支持直接按起止日期查询
// 当前阶段：自定义范围通过天数差计算后传入现有 useDailyStats / useStatusDistribution

function getCustomRangeLabel(range: [dayjs.Dayjs, dayjs.Dayjs] | null): string {
  if (!range) {
    return '自定义范围';
  }
  return `${range[0].format('MM-DD')} ~ ${range[1].format('MM-DD')}`;
}

function getResolvedDays(range: RangeKey, customRange: [dayjs.Dayjs, dayjs.Dayjs] | null): number {
  if (range === 'custom' && customRange) {
    return Math.ceil(customRange[1].diff(customRange[0], 'day')) || 1;
  }
  return Number(range);
}

const DashboardPage: React.FC = () => {
const { shopId, ready, currentShop, canSwitchShops } = useShopContext();
const [range, setRange] = useState<RangeKey>('7');
const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

// ---- 平台管理员「全店汇总」自动默认切 all ----
useEffect(() => {
if (!canSwitchShops) return;
if (range !== 'all') {
setRange('all');
}
}, [canSwitchShops, range]);

const isAllShops = range === 'all';

// 全店汇总已禁用：后端暂未支持跨店聚合，改为持久化提示卡片
const BACKEND_ALL_SHOPS_READY = false;

// 有效 shopId：all 模式传 undefined 让后端聚合（后端不支持则前端降级：取当前店兜底）
const effectiveShopId = !isAllShops && shopId ? shopId : undefined;

// ---- React Query ----
// 全店汇总：后端暂未支持跨店聚合时，仍用当前选中店兜底展示
const fallbackShopId = shopId ?? undefined;
const { data: stats, isFetching: statsFetching } = useOrderStatsToday(isAllShops ? fallbackShopId : effectiveShopId);

const resolvedDays = getResolvedDays(range, customRange);

const { data: dailyRaw, isFetching: dailyFetching } = useDailyStats(
ready && !isAllShops ? effectiveShopId : fallbackShopId,
resolvedDays,
);

const { data: distRaw, isFetching: distFetching } = useStatusDistribution(
ready && !isAllShops ? effectiveShopId : fallbackShopId,
resolvedDays,
);

const chartLoading = dailyFetching || distFetching;

// 全店汇总提示（后端未支持时）
useEffect(() => {
if (isAllShops && !BACKEND_ALL_SHOPS_READY) {
message.info('全店汇总功能开发中，当前展示已选门店数据');
}
}, [isAllShops]);

// 手动刷新：精准 invalidate
const handleRefresh = () => {
const targetShopId = isAllShops ? undefined : effectiveShopId;
void queryClient.invalidateQueries({ queryKey: queryKeys.orders.statsToday(targetShopId) });
void queryClient.invalidateQueries({ queryKey: queryKeys.orders.statsDaily(targetShopId, resolvedDays) });
void queryClient.invalidateQueries({ queryKey: queryKeys.orders.statsStatus(targetShopId, resolvedDays) });
};

  // 派生展示数据
  const dailyStats = (dailyRaw || []).map((d: ApiDailyStatsItem) => {
    const parts = d.date.split('-');
    return {
      date: parts.length >= 3 ? `${parts[1]}-${parts[2]}` : d.date,
      orders: d.orders,
      revenue: Math.round((d.revenue || 0) / 100),
    };
  });

  const rangeOrders = dailyStats.reduce((s, d) => s + d.orders, 0);
  const rangeRevenue = dailyStats.reduce((s, d) => s + d.revenue, 0);
  const rangeCompleted = (distRaw || [])
    .filter((item) => item.status === 'completed')
    .reduce((s, item) => s + (item.count || 0), 0);

  const statusStats = (distRaw || []).map((item: StatusDistributionItem) => ({
    type: getStatusText(item.status),
    value: item.count,
  }));
  const pieData = statusStats.length > 0 ? statusStats : [{ type: '暂无数据', value: 1 }];

const isToday = range === '1';
const isCustom = range === 'custom';

const displayOrders = isToday ? (stats?.totalOrders || 0) : rangeOrders;
const displayRevenue = isToday
? (stats?.totalRevenue ? formatPrice(stats.totalRevenue).replace('¥', '') : '0.00')
: rangeRevenue.toFixed(2);
const displayCompleted = isToday ? (stats?.completedCount || 0) : rangeCompleted;

const rangeTitle =
isToday ? '今日' : isAllShops ? '全店汇总' : isCustom ? getCustomRangeLabel(customRange) : `近${range}天`;

const statCards = [
{
title: `${rangeTitle}订单`,
value: displayOrders,
icon: <ShoppingCartOutlined />,
color: brand.primary,
bgColor: brand.primaryLight,
},
{
title: `${rangeTitle}营收`,
value: displayRevenue,
suffix: '元',
icon: <MoneyCollectOutlined />,
color: brand.success,
bgColor: brand.successSoft,
},
{
title: '当前待处理',
value: stats?.pendingCount || 0,
icon: <ClockCircleOutlined />,
color: brand.warning,
bgColor: brand.warningSoft,
},
{
title: `${rangeTitle}已完成`,
value: displayCompleted,
icon: <CheckCircleOutlined />,
color: brand.success,
bgColor: brand.successSoft,
},
];

  const lineConfig = {
    data: dailyStats,
    xField: 'date',
    yField: 'orders',
    smooth: true,
    point: { size: 5, shape: 'diamond' as const },
    label: { style: { fill: brand.chartAxis, fontSize: 'var(--tf-font-xs)' } },
    color: brand.primary,
  };

  const revenueConfig = {
    data: dailyStats,
    xField: 'date',
    yField: 'revenue',
    smooth: true,
    point: { size: 5, shape: 'circle' as const },
    label: { style: { fill: brand.chartAxis, fontSize: 'var(--tf-font-xs)' } },
    color: brand.success,
  };

  const pieConfig = {
    data: pieData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    innerRadius: 0.6,
    label: { text: 'type', style: { fontSize: 'var(--tf-font-xs)' } },
    legend: { position: 'bottom' as const },
    interaction: { elementHighlight: true },
  };

const rangeLabel = isAllShops
? '全店汇总'
: isCustom
? getCustomRangeLabel(customRange)
: RANGE_OPTIONS.find((o) => o.value === range)?.label || '近7天';

  return (
    <div className="tf-page">
<PageHeaderActions
icon={<RiseOutlined style={{ marginRight: 8 }} />}
title={isAllShops ? '数据看板 · 全店汇总' : currentShop?.name ? `数据看板 · ${currentShop.name}` : '数据看板'}
onRefresh={handleRefresh}
/>

<div style={{ marginBottom: 'var(--tf-space-4)' }}>
<Segmented
options={canSwitchShops ? [...RANGE_OPTIONS, ALL_SHOPS_RANGE_OPTION] : RANGE_OPTIONS}
value={isAllShops ? 'all' : range}
onChange={(v) => {
const next = String(v) as RangeKey;
setRange(next);
if (next !== 'custom') {
setCustomRange(null);
}
}}
/>
{(isAllShops || range === 'custom') && (
<RangePicker
value={customRange}
onChange={(dates) => {
const d = dates as [dayjs.Dayjs, dayjs.Dayjs] | null;
setCustomRange(d);
}}
style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 8 }}
/>
)}
</div>

      <Row gutter={[16, 16]} style={{ marginBottom: 'var(--tf-space-6)' }}>
        {statCards.map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.title}>
            <StatisticCard
              title={card.title}
              value={card.value}
              suffix={card.suffix}
              icon={card.icon}
              color={card.color}
              bgColor={card.bgColor}
            />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 'var(--tf-space-6)' }}>
        <Col xs={24} lg={14}>
          <Card
            title={<Space><LineChartOutlined /><span>{rangeLabel}订单趋势</span></Space>}
            bordered={false}
            style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}
          >
            {chartLoading ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : (
              <div style={{ height: 300 }}><Line {...lineConfig} /></div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
<Card
title={<Space><PieChartOutlined /><span>{isAllShops ? '全店订单状态分布' : isToday ? '今日订单状态分布' : `近${range}天订单状态分布`}</span></Space>}
bordered={false}
style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}
>
            {chartLoading ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : (
              <div style={{ height: 300 }}><Pie {...pieConfig} /></div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 'var(--tf-space-6)' }}>
        <Col span={24}>
          <Card
            title={<Space><LineChartOutlined /><span>{rangeLabel}营收趋势（元）</span></Space>}
            bordered={false}
            style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}
          >
            {chartLoading ? (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : (
              <div style={{ height: 280 }}><Line {...revenueConfig} /></div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
