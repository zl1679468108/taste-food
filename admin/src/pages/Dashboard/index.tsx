import React, { useMemo, useState } from 'react';
import { Card, Col, Row, Skeleton, Space } from 'antd';
import { useModel } from '@umijs/max';
import dayjs, { type Dayjs } from 'dayjs';
import {
  ShoppingCartOutlined,
  MoneyCollectOutlined,
  RiseOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import type { DailyStatsItem } from '@/services/order';
import type { Shop } from '@/services/shop';
import { formatPrice } from '@/utils/format';
import DashboardStatCard from '@/components/DashboardStatCard';
import DashboardPendingCard from '@/components/DashboardPendingCard';
import DashboardRangeControl, {
  MAX_RANGE_DAYS,
  type PresetRange,
  type StatsScope,
} from '@/components/DashboardRangeControl';
import PageHeaderActions from '@/components/PageHeaderActions';
import { useShopContext } from '@/hooks/useShopContext';
import { brand } from '@/theme';
import { useDashboardStats } from '@/hooks/queries/useDashboardQueries';
import { computeAccess } from '@/utils/computeAccess';
import { queryClient } from '@/lib/queryClient';

const DATE_FMT = 'YYYY-MM-DD';

interface PeriodSum {
  orders: number;
  /** 单位：分 */
  revenue: number;
}

function sumItems(items: DailyStatsItem[]): PeriodSum {
  return items.reduce<PeriodSum>(
    (acc, d) => ({
      orders: acc.orders + (d.orders || 0),
      revenue: acc.revenue + (d.revenue || 0),
    }),
    { orders: 0, revenue: 0 },
  );
}

const DashboardPage: React.FC = () => {
  // 与 src/access.ts 的 canPlatformAdmin 口径保持一致：
  // initialState.admin.canPlatformAdmin 优先，缺省时回退 role === 'admin' 且未绑定 shopId
  const { initialState } = useModel('@@initialState');
  const { shopId, shops, loaded, currentShop, scope } = useShopContext();

  const [preset, setPreset] = useState<PresetRange>('7');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);

  // 全店口径统一由顶栏店铺选择器控制（scope）；其余角色恒为单店
  const canPlatformAdmin =
    initialState?.admin?.canPlatformAdmin ??
    (initialState?.currentUser?.role === 'admin' && !initialState?.currentUser?.shopId);
  const effectiveScope: StatsScope = canPlatformAdmin ? scope : 'shop';
  // 平台管理员无订单管理页，待处理区仅作信息展示、不可跳转
  const canMerchant = computeAccess(initialState?.currentUser).canMerchant;
  const shopList = (shops || []) as Shop[];
  const isAllShops = effectiveScope === 'all';

  // ---- 统计区间：本期 + 上一等长期 ----
  const todayStr = dayjs().format(DATE_FMT);
  const customKey = customRange
    ? `${customRange[0].format(DATE_FMT)}_${customRange[1].format(DATE_FMT)}`
    : '';

  const period = useMemo(() => {
    const today = dayjs(todayStr);
    const [start, end] = customKey
      ? [dayjs(customKey.split('_')[0]), dayjs(customKey.split('_')[1])]
      : [today.subtract(Number(preset) - 1, 'day'), today];

    const spanDays = Math.min(Math.max(end.diff(start, 'day') + 1, 1), MAX_RANGE_DAYS);
    const prevEnd = start.subtract(1, 'day');
    const prevStart = prevEnd.subtract(spanDays - 1, 'day');

    return {
      spanDays,
      startStr: start.format(DATE_FMT),
      endStr: end.format(DATE_FMT),
      prevStartStr: prevStart.format(DATE_FMT),
      prevEndStr: prevEnd.format(DATE_FMT),
    };
  }, [customKey, preset, todayStr]);

  // 一次取数覆盖「上一期起点 ~ 本期终点」，前端再按日期切片，避免两次请求
  const fetchRange = {
    startDate: period.prevStartStr,
    endDate: period.endStr,
  };

  const shopIds = useMemo(() => {
    if (isAllShops) return shopList.map((s) => s.id);
    return shopId ? [shopId] : [];
  }, [isAllShops, shopList, shopId]);

  const { todayStats, dailyStats, pendingStats, isLoading, shopCount } = useDashboardStats({
    shopIds,
    range: fetchRange,
    days: period.spanDays * 2,
    enabled: loaded && shopIds.length > 0,
  });

  // ---- 本期 / 上一期切片（YYYY-MM-DD 可直接字典序比较）----
  const currentItems = dailyStats.filter(
    (d) => d.date >= period.startStr && d.date <= period.endStr,
  );
  const previousItems = dailyStats.filter(
    (d) => d.date >= period.prevStartStr && d.date <= period.prevEndStr,
  );
  const currentSum = sumItems(currentItems);
  const previousSum = sumItems(previousItems);

  // ---- 文案 ----
  const isToday = !customRange && preset === '1';
  const scopeSuffix = '';
  const rangeLabel = customRange
    ? `${period.startStr} ~ ${period.endStr}`
    : isToday
      ? '今日'
      : `近${preset}天`;
  const compareLabel = isToday ? '较昨日' : '较上一周期';
  const compareRangeText = isToday
    ? period.prevStartStr
    : `${period.prevStartStr} ~ ${period.prevEndStr}`;

  const loading = isLoading;

  const statCards = [
    {
      key: 'orders',
      title: `${rangeLabel}订单${scopeSuffix}`,
      value: currentSum.orders,
      icon: <ShoppingCartOutlined />,
      color: brand.primary,
      bgColor: brand.primaryLight,
      current: currentSum.orders,
      previous: previousSum.orders,
      compareTip: `上一周期（${compareRangeText}）：${previousSum.orders} 单`,
    },
    {
      key: 'revenue',
      title: `${rangeLabel}营收${scopeSuffix}`,
      value: formatPrice(currentSum.revenue),
      icon: <MoneyCollectOutlined />,
      color: brand.success,
      bgColor: brand.successSoft,
      current: currentSum.revenue,
      previous: previousSum.revenue,
      compareTip: `上一周期（${compareRangeText}）：${formatPrice(previousSum.revenue)}`,
    },
  ];

  // ---- 图表（营收转元展示，字段名直接中文化以统一 tooltip）----
  const chartData = currentItems.map((d) => {
    const parts = d.date.split('-');
    return {
      date: parts.length >= 3 ? `${parts[1]}-${parts[2]}` : d.date,
      订单数: d.orders,
      营收: Number(((d.revenue || 0) / 100).toFixed(2)),
    };
  });

  const lineConfig = {
    data: chartData,
    xField: 'date',
    yField: '订单数',
    smooth: true,
    point: { size: 4, shape: 'diamond' as const },
    label: {
      content: ({ 订单数 }: { 订单数: number }) => (订单数 > 0 ? String(订单数) : ''),
      style: {
        fill: brand.textPrimary,
        fontSize: 11,
        fontWeight: 500,
        textBaseline: 'bottom' as const,
      },
      offset: 8,
    },
    color: brand.primary,
    tooltip: {
      title: (d: { date: string }) => {
        const [m, dd] = d.date.split('-');
        return `${dayjs().year()}-${String(m).padStart(2, '0')}-${dd}`;
      },
    },
  };

  const revenueConfig = {
    data: chartData,
    xField: 'date',
    yField: '营收',
    smooth: true,
    point: { size: 4, shape: 'circle' as const },
    label: {
      content: ({ 营收 }: { 营收: number }) => (营收 > 0 ? String(营收) : ''),
      style: {
        fill: brand.textPrimary,
        fontSize: 11,
        fontWeight: 500,
        textBaseline: 'bottom' as const,
      },
      offset: 8,
    },
    color: brand.success,
    tooltip: {
      title: (d: { date: string }) => {
        const [m, dd] = d.date.split('-');
        return `${dayjs().year()}-${String(m).padStart(2, '0')}-${dd}`;
      },
    },
  };

  const handleRefresh = () => {
    // 统一失效 orders/stats 前缀，覆盖单店与全店汇总下的所有分片
    void queryClient.invalidateQueries({ queryKey: ['orders', 'stats'] });
  };

  const headerTitle = isAllShops
    ? '数据看板 · 全店汇总'
    : currentShop?.name
      ? `数据看板 · ${currentShop.name}`
      : '数据看板';

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<RiseOutlined style={{ marginRight: 'var(--tf-space-2)'}} />}
        title={headerTitle}
        onRefresh={handleRefresh}
      />

      {/* 待处理：常驻、不限时间维度，置于时间范围控件之上，独立于订单数/营收 */}
      <DashboardPendingCard stats={pendingStats} loading={isLoading} clickable={canMerchant} />

      <div style={{ marginBottom: 'var(--tf-space-4)' }}>
        <DashboardRangeControl
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          isAllShops={isAllShops}
          shopCount={shopCount}
          disabled={!loaded}
        />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 'var(--tf-space-6)' }}>
        {statCards.map((card) => (
          <Col xs={24} sm={12} lg={8} key={card.key}>
            <DashboardStatCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              color={card.color}
              bgColor={card.bgColor}
              current={card.current}
              previous={card.previous}
              compareLabel={compareLabel}
              compareTip={card.compareTip}
              loading={loading}
            />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 'var(--tf-space-6)' }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <LineChartOutlined />
                <span>
                  {rangeLabel}订单趋势{scopeSuffix}
                </span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <div style={{ height: 300 }}>
                <Line {...lineConfig} />
              </div>
            )}
              </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <LineChartOutlined />
                <span>
                  {rangeLabel}营收趋势（元）{scopeSuffix}
                </span>
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <div style={{ height: 300 }}>
                <Line {...revenueConfig} />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
