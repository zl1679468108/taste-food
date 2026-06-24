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
import { getOrderStats, getOrders, Order, OrderStats } from '@/services/order';
import { formatTime, shortOrderId } from '@/utils/format';
import OrderStatusTag from '@/components/OrderStatusTag';
import request from '@/utils/request';

const { Title, Text } = Typography;

const DEFAULT_SHOP_ID = 'shop001';

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
      const [statsResult, ordersResult] = await Promise.all([
        getOrderStats(DEFAULT_SHOP_ID),
        getOrders({ shop_id: DEFAULT_SHOP_ID, page: 1, pageSize: 10 }),
      ]);
      setStats(statsResult);
      setOrders(ordersResult?.items || []);

      // 从订单数据生成统计
      generateChartStats(ordersResult?.items || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
      setChartLoading(false);
    }
  };

  const generateChartStats = (orderList: Order[]) => {
    // 生成状态分布
    const statusMap: Record<string, number> = {};
    orderList.forEach(order => {
      const statusText = getStatusText(order.status);
      statusMap[statusText] = (statusMap[statusText] || 0) + 1;
    });
    const statusData = Object.entries(statusMap).map(([type, value]) => ({ type, value }));
    setStatusStats(statusData.length > 0 ? statusData : [{ type: '暂无数据', value: 1 }]);

    // 生成近7天数据（从订单中提取）
    const dailyMap: Record<string, { orders: number; revenue: number }> = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dailyMap[dateStr] = { orders: 0, revenue: 0 };
    }

    orderList.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const dateStr = `${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].orders += 1;
        dailyMap[dateStr].revenue += order.total;
      }
    });

    const weeklyData = Object.entries(dailyMap).map(([date, data]) => ({
      date,
      orders: data.orders,
      revenue: Math.round(data.revenue / 100),
    }));
    setDailyStats(weeklyData);
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
      render: (total: number) => (
        <Text strong style={{ color: '#f5222d' }}>
          ¥{(total / 100).toFixed(2)}
        </Text>
      ),
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
      value: stats?.totalRevenue ? (stats.totalRevenue / 100).toFixed(2) : '0.00',
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