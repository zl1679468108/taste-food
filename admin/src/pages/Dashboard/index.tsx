import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Col, Row, Table, Typography, Space, Spin, Segmented, Button, message,
} from 'antd';
import {
  ShoppingCartOutlined,
  MoneyCollectOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  LineChartOutlined,
  PieChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import {
  getOrderStats,
  getOrders,
  getDailyStats,
  getStatusDistribution,
  Order,
  OrderStats,
  DailyStatsItem as ApiDailyStatsItem,
  StatusDistributionItem,
} from '@/services/order';
import { formatTime, shortOrderId, formatPrice } from '@/utils/format';
import OrderStatusTag from '@/components/OrderStatusTag';
import PriceDisplay from '@/components/PriceDisplay';
import DeliveryTypeTag from '@/components/DeliveryTypeTag';
import StatisticCard from '@/components/StatisticCard';
import PageHeaderActions from '@/components/PageHeaderActions';
import { DEFAULT_SHOP_ID } from '@/utils/constants';
import { DEFAULT_TABLE_LOCALE } from '@/utils/table';
import { brand } from '@/theme';

const { Text } = Typography;

type RangeKey = '1' | '7' | '30';

interface DailyStats {
  date: string;
  orders: number;
  revenue: number;
}

interface StatusStats {
  type: string;
  value: number;
}

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
  ready_for_pickup: '待自取',
};

function getStatusText(status: string): string {
  return STATUS_TEXT[status] || status;
}

const DashboardPage: React.FC = () => {
  const [range, setRange] = useState<RangeKey>('7');
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStats[]>([]);
  const [rangeStats, setRangeStats] = useState({ orders: 0, revenue: 0 });

  const loadData = useCallback(async (days: number) => {
    setLoading(true);
    setChartLoading(true);
    try {
      const [statsResult, ordersResult, dailyResult, distResult] = await Promise.all([
        getOrderStats(DEFAULT_SHOP_ID),
        getOrders({ shop_id: DEFAULT_SHOP_ID, page: 1, pageSize: 10 }),
        getDailyStats(DEFAULT_SHOP_ID, days),
        getStatusDistribution(DEFAULT_SHOP_ID),
      ]);

      setStats(statsResult);
      setOrders(ordersResult?.items || []);

      const dailyData = (dailyResult || []).map((d: ApiDailyStatsItem) => {
        const parts = d.date.split('-');
        return {
          date: parts.length >= 3 ? `${parts[1]}-${parts[2]}` : d.date,
          orders: d.orders,
          revenue: Math.round((d.revenue || 0) / 100),
        };
      });
      setDailyStats(dailyData);

      const rangeOrders = dailyData.reduce((s, d) => s + d.orders, 0);
      const rangeRevenue = dailyData.reduce((s, d) => s + d.revenue, 0);
      setRangeStats({ orders: rangeOrders, revenue: rangeRevenue });

      const distData = (distResult || []).map((item: StatusDistributionItem) => ({
        type: getStatusText(item.status),
        value: item.count,
      }));
      setStatusStats(distData.length > 0 ? distData : [{ type: '暂无数据', value: 1 }]);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载看板数据失败');
    } finally {
      setLoading(false);
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(Number(range));
  }, [range, loadData]);

  const handleRangeChange = (value: string | number) => {
    setRange(String(value) as RangeKey);
  };

  const columns = useMemo(
    () => [
      {
        title: '订单号',
        dataIndex: 'id',
        key: 'id',
        render: (id: string) => (
          <Text strong style={{ fontFamily: 'monospace' }}>
            {shortOrderId(id)}
          </Text>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => <OrderStatusTag status={status} />,
      },
      {
        title: '配送方式',
        dataIndex: 'deliveryType',
        key: 'deliveryType',
        render: (type: string) => <DeliveryTypeTag type={type} />,
      },
      {
        title: '金额',
        dataIndex: 'total',
        key: 'total',
        render: (total: number) => <PriceDisplay price={total} />,
      },
      {
        title: '时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (time: string) => formatTime(time, 'MM-DD HH:mm'),
      },
    ],
    [],
  );

  // 今日：顶部卡用 today stats；7/30 天：用区间汇总 + 今日待处理/已完成仍参考 today stats
  const isToday = range === '1';
  const displayOrders = isToday ? (stats?.totalOrders || 0) : rangeStats.orders;
  const displayRevenue = isToday
    ? (stats?.totalRevenue ? formatPrice(stats.totalRevenue).replace('¥', '') : '0.00')
    : rangeStats.revenue.toFixed(2);
  const ordersTitle = isToday ? '今日订单' : `近${range}天订单`;
  const revenueTitle = isToday ? '今日营收' : `近${range}天营收`;

  const statCards = [
    {
      title: ordersTitle,
      value: displayOrders,
      icon: <ShoppingCartOutlined />,
      color: brand.primary,
      bgColor: brand.primaryLight,
    },
    {
      title: revenueTitle,
      value: displayRevenue,
      suffix: '元',
      icon: <MoneyCollectOutlined />,
      color: brand.success,
      bgColor: '#f6ffed',
    },
    {
      title: '待处理',
      value: stats?.pendingCount || 0,
      icon: <ClockCircleOutlined />,
      color: brand.warning,
      bgColor: '#fffbe6',
    },
    {
      title: '已完成',
      value: stats?.completedCount || 0,
      icon: <CheckCircleOutlined />,
      color: brand.success,
      bgColor: '#f6ffed',
    },
  ];

  const lineConfig = {
    data: dailyStats,
    xField: 'date',
    yField: 'orders',
    smooth: true,
    point: { size: 5, shape: 'diamond' as const },
    label: { style: { fill: '#aaa', fontSize: 12 } },
    color: brand.primary,
  };

  const revenueConfig = {
    data: dailyStats,
    xField: 'date',
    yField: 'revenue',
    smooth: true,
    point: { size: 5, shape: 'circle' as const },
    label: { style: { fill: '#aaa', fontSize: 12 } },
    color: brand.success,
  };

  const pieConfig = {
    data: statusStats,
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
    <div>
      <PageHeaderActions
        icon={<RiseOutlined style={{ marginRight: 8 }} />}
        title="数据看板"
        onRefresh={() => loadData(Number(range))}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Segmented
          options={RANGE_OPTIONS}
          value={range}
          onChange={handleRangeChange}
        />
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => loadData(Number(range))}
        >
          刷新
        </Button>
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
            title={
              <Space>
                <LineChartOutlined />
                <span>{rangeLabel}订单趋势</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}
          >
            {chartLoading ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : (
              <div style={{ height: 300 }}>
                <Line {...lineConfig} />
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <PieChartOutlined />
                <span>订单状态分布</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}
          >
            {chartLoading ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : (
              <div style={{ height: 300 }}>
                <Pie {...pieConfig} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <LineChartOutlined />
                <span>{rangeLabel}营收趋势（元）</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}
          >
            {chartLoading ? (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin />
              </div>
            ) : (
              <div style={{ height: 280 }}>
                <Line {...revenueConfig} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="最近订单"
        bordered={false}
        style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}
      >
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
          locale={DEFAULT_TABLE_LOCALE}
        />
      </Card>
    </div>
  );
};

export default DashboardPage;
