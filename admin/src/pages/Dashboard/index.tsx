import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, Space, Tag, Spin } from 'antd';
import {
  ShoppingCartOutlined,
  MoneyCollectOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  AlertOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { Column, Pie, Line } from '@ant-design/charts';
import { getOrderStats, getOrders, getDailyStats, getStatusDistribution, Order, OrderStats, DailyStatsItem as ApiDailyStatsItem, StatusDistributionItem } from '@/services/order';
import { formatTime, shortOrderId, formatPrice } from '@/utils/format';
import OrderStatusTag from '@/components/OrderStatusTag';
import PriceDisplay from '@/components/PriceDisplay';
import { DEFAULT_SHOP_ID } from '@/utils/constants';

const { Title, Text } = Typography;

interface DailyStats {
  date: string;
  orders: number;
  revenue: number;
}

interface StatusStats {
  type: string;
  value: number;
}

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [statusStats, setStatusStats] = useState<StatusStats[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setChartLoading(true);
    try {
      // 并行加载：今日统计、最近订单、近7天日趋势、状态分布
      const [statsResult, ordersResult, dailyResult, distResult] = await Promise.all([
        getOrderStats(DEFAULT_SHOP_ID),
        getOrders({ shop_id: DEFAULT_SHOP_ID, page: 1, pageSize: 10 }),
        getDailyStats(DEFAULT_SHOP_ID, 7),
        getStatusDistribution(DEFAULT_SHOP_ID),
      ]);
      setStats(statsResult);
      setOrders(ordersResult?.items || []);

      // 日趋势：后端按天聚合，前端仅做格式转换（取 MM-DD 作为图表 x 轴）
      const dailyData = (dailyResult || []).map((d: ApiDailyStatsItem) => {
        const parts = d.date.split('-');
        return {
          date: `${parts[1]}-${parts[2]}`,
          orders: d.orders,
          revenue: Math.round(d.revenue / 100), // 分转元
        };
      });
      setDailyStats(dailyData);

      // 状态分布：后端全量聚合，前端转中文文案
      const distData = (distResult || []).map((item: StatusDistributionItem) => ({
        type: getStatusText(item.status),
        value: item.count,
      }));
      setStatusStats(distData.length > 0 ? distData : [{ type: '暂无数据', value: 1 }]);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
      setChartLoading(false);
    }
  };

  const getStatusText = (status: string): string => {
    const map: Record<string, string> = {
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
    return map[status] || status;
  };

  const columns = [
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
      render: (type: string) => {
        const map: Record<string, { color: string; text: string }> = {
          delivery: { color: 'blue', text: '外卖' },
          pickup: { color: 'green', text: '自取' },
          dine_in: { color: 'orange', text: '堂食' },
        };
        const config = map[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
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
  ];

  const statCards = [
    {
      title: '今日订单',
      value: stats?.totalOrders || 0,
      icon: <ShoppingCartOutlined />,
      color: '#1890ff',
      bgColor: '#e6f7ff',
    },
    {
      title: '今日营收',
      value: stats?.totalRevenue ? formatPrice(stats.totalRevenue).replace('¥', '') : '0.00',
      suffix: '元',
      icon: <MoneyCollectOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
    },
    {
      title: '待处理',
      value: stats?.pendingCount || 0,
      icon: <ClockCircleOutlined />,
      color: '#faad14',
      bgColor: '#fffbe6',
    },
    {
      title: '已完成',
      value: stats?.completedCount || 0,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
    },
  ];

  // 订单趋势图表配置
  const lineConfig = {
    data: dailyStats,
    xField: 'date',
    yField: 'orders',
    smooth: true,
    point: { size: 5, shape: 'diamond' },
    label: { style: { fill: '#aaa', fontSize: 12 } },
    color: '#1890ff',
  };

  // 营收趋势图表配置
  const revenueConfig = {
    data: dailyStats,
    xField: 'date',
    yField: 'revenue',
    smooth: true,
    point: { size: 5, shape: 'circle' },
    label: { style: { fill: '#aaa', fontSize: 12 } },
    color: '#52c41a',
  };

  // 订单状态分布图表配置
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

  // 每日订单柱状图配置
  const columnConfig = {
    data: dailyStats,
    xField: 'date',
    yField: 'orders',
    label: { position: 'middle' as const, style: { fill: '#fff', fontSize: 12 } },
    color: '#1890ff',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <RiseOutlined style={{ marginRight: 8 }} />
          数据看板
        </Title>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Statistic
                title={card.title}
                value={card.value}
                suffix={card.suffix}
                prefix={
                  <div style={{
                    color: card.color, backgroundColor: card.bgColor,
                    width: 48, height: 48, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                  }}>
                    {card.icon}
                  </div>
                }
                valueStyle={{ color: '#333', fontWeight: 600 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title={<Space><LineChartOutlined /><span>近7天订单趋势</span></Space>} bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {chartLoading ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div> : <div style={{ height: 300 }}><Line {...lineConfig} /></div>}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<Space><PieChartOutlined /><span>订单状态分布</span></Space>} bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {chartLoading ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div> : <div style={{ height: 300 }}><Pie {...pieConfig} /></div>}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title={<Space><BarChartOutlined /><span>每日订单量</span></Space>} bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {chartLoading ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div> : <div style={{ height: 300 }}><Column {...columnConfig} /></div>}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Space><RiseOutlined /><span>近7天营收趋势</span></Space>} bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {chartLoading ? <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div> : <div style={{ height: 300 }}><Line {...revenueConfig} /></div>}
          </Card>
        </Col>
      </Row>

      {/* 最近订单 */}
      <Card title={<Space><AlertOutlined /><span>最近订单</span></Space>} bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Table columns={columns} dataSource={orders} rowKey="id" loading={loading} pagination={false} size="middle" />
      </Card>
    </div>
  );
};

export default DashboardPage;