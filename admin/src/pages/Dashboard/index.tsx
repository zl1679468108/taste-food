import React, { useState } from 'react';
import {
  Card, Col, Row, Space, Spin, Segmented,
} from 'antd';
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
import { DailyStatsItem as ApiDailyStatsItem, StatusDistributionItem } from '@/services/order';
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

type RangeKey = '1' | '7' | '30';

const RANGE_OPTIONS = [
  { label: '今日', value: '1' },
  { label: '近7天', value: '7' },
  { label: '近30天', value: '30' },
];

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

const DashboardPage: React.FC = () => {
  const { shopId, ready, currentShop } = useShopContext();
  const [range, setRange] = useState<RangeKey>('7');

  // ---- React Query 替换原 useState + useEffect 手动拉取 ----
  const { data: stats, isFetching: statsFetching } = useOrderStatsToday(shopId ?? undefined);

  const { data: dailyRaw, isFetching: dailyFetching } = useDailyStats(
    ready ? shopId ?? undefined : undefined,
    Number(range),
  );

  const { data: distRaw, isFetching: distFetching } = useStatusDistribution(
    ready ? shopId ?? undefined : undefined,
    Number(range),
  );

  const chartLoading = dailyFetching || distFetching;

  // 手动刷新：精准 invalidate 当前页用到的三个 key
  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.statsToday(shopId ?? undefined) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.statsDaily(shopId ?? undefined, Number(range)) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.statsStatus(shopId ?? undefined, Number(range)) });
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
  const displayOrders = isToday ? (stats?.totalOrders || 0) : rangeOrders;
  const displayRevenue = isToday
    ? (stats?.totalRevenue ? formatPrice(stats.totalRevenue).replace('¥', '') : '0.00')
    : rangeRevenue.toFixed(2);
  const displayCompleted = isToday ? (stats?.completedCount || 0) : rangeCompleted;

  const statCards = [
    {
      title: isToday ? '今日订单' : `近${range}天订单`,
      value: displayOrders,
      icon: <ShoppingCartOutlined />,
      color: brand.primary,
      bgColor: brand.primaryLight,
    },
    {
      title: isToday ? '今日营收' : `近${range}天营收`,
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
      title: isToday ? '今日已完成' : `近${range}天已完成`,
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
    label: { style: { fill: brand.chartAxis, fontSize: brand.fontXs } },
    color: brand.primary,
  };

  const revenueConfig = {
    data: dailyStats,
    xField: 'date',
    yField: 'revenue',
    smooth: true,
    point: { size: 5, shape: 'circle' as const },
    label: { style: { fill: brand.chartAxis, fontSize: brand.fontXs } },
    color: brand.success,
  };

  const pieConfig = {
    data: pieData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    innerRadius: 0.6,
    label: { text: 'type', style: { fontSize: 12 } },
    legend: { position: 'bottom' as const },
    interaction: { elementHighlight: true },
  };

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label || '近7天';

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<RiseOutlined style={{ marginRight: 8 }} />}
        title={currentShop?.name ? `数据看板 · ${currentShop.name}` : '数据看板'}
        onRefresh={handleRefresh}
      />

      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={RANGE_OPTIONS}
          value={range}
          onChange={(v) => setRange(String(v) as RangeKey)}
        />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
            title={<Space><PieChartOutlined /><span>{isToday ? '今日' : `近${range}天`}订单状态分布</span></Space>}
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

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
