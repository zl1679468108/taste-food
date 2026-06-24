import React, { useEffect, useState } from 'react';
import { Table, Button, Typography, Tabs, Modal, Descriptions, message, Space, Card, Tag } from 'antd';
import { EyeOutlined, ReloadOutlined, OrderedListOutlined } from '@ant-design/icons';
import { getOrders, getOrder, updateOrderStatus, Order, OrderStats, getOrderStats } from '@/services/order';
import OrderStatusTag from '@/components/OrderStatusTag';
import { formatPrice, formatTime, shortOrderId } from '@/utils/format';

const { Title, Text } = Typography;

const DEFAULT_SHOP_ID = 'shop001';

const OrderPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadOrders();
  }, [activeTab, page]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: any = {
        shop_id: DEFAULT_SHOP_ID,
        page,
        pageSize: 10,
      };
      if (activeTab) {
        params.status = activeTab;
      }
      const res = await getOrders(params);
      setOrders(res?.items || []);
      setTotal(res?.total || 0);
    } catch (error) {
      console.error('加载订单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (order: Order) => {
    setSelectedOrder(order);
    setDetailVisible(true);
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(orderId, status);
      message.success('状态更新成功');
      loadOrders();
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const getAvailableActions = (order: Order) => {
    const actions: { label: string; status: string; type: 'primary' | 'danger' }[] = [];

    switch (order.status) {
      case 'paid':
        actions.push({ label: '接单', status: 'accepted', type: 'primary' });
        actions.push({ label: '拒单', status: 'rejected', type: 'danger' });
        break;
      case 'accepted':
        actions.push({ label: '开始制作', status: 'preparing', type: 'primary' });
        break;
      case 'preparing':
        if (order.deliveryType === 'delivery') {
          actions.push({ label: '呼叫配送', status: 'delivering', type: 'primary' });
        } else if (order.deliveryType === 'pickup') {
          actions.push({ label: '待自取', status: 'ready_for_pickup', type: 'primary' });
        } else {
          actions.push({ label: '完成', status: 'completed', type: 'primary' });
        }
        break;
      case 'ready_for_pickup':
        actions.push({ label: '确认取餐', status: 'completed', type: 'primary' });
        break;
      case 'delivering':
        actions.push({ label: '确认送达', status: 'completed', type: 'primary' });
        break;
    }

    return actions;
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
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Order) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {getAvailableActions(record).map(action => (
            <Button
              key={action.status}
              type="link"
              danger={action.type === 'danger'}
              onClick={() => handleStatusUpdate(record.id, action.status)}
            >
              {action.label}
            </Button>
          ))}
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: '', label: '全部' },
    { key: 'paid', label: '已支付' },
    { key: 'accepted', label: '已接单' },
    { key: 'preparing', label: '制作中' },
    { key: 'delivering', label: '配送中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
  ];

  return (
    <div >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <OrderedListOutlined style={{ marginRight: 8 }} />
          订单管理
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadOrders}>
          刷新
        </Button>
      </div>

      <Card
        bordered={false}
        style={{
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => { setActiveTab(key); setPage(1); }}
          items={tabItems}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedOrder && (
          <Descriptions column={2} bordered size="middle">
            <Descriptions.Item label="订单号">
              <Text strong style={{ fontFamily: 'monospace' }}>
                {shortOrderId(selectedOrder.id)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <OrderStatusTag status={selectedOrder.status} />
            </Descriptions.Item>
            <Descriptions.Item label="配送方式">
              <Tag color={selectedOrder.deliveryType === 'delivery' ? 'blue' :
                selectedOrder.deliveryType === 'pickup' ? 'green' : 'orange'}>
                {selectedOrder.deliveryType === 'delivery' ? '外卖' :
                  selectedOrder.deliveryType === 'pickup' ? '自取' : '堂食'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="金额">
              <Text strong style={{ color: '#f5222d', fontSize: 16 }}>
                {formatPrice(selectedOrder.total)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="商品" span={2}>
              {selectedOrder.items?.map(item =>
                `${item.name} x${item.quantity}`
              ).join('、')}
            </Descriptions.Item>
            {selectedOrder.address && (
              <Descriptions.Item label="地址" span={2}>{selectedOrder.address}</Descriptions.Item>
            )}
            {selectedOrder.tableNo && (
              <Descriptions.Item label="桌号">{selectedOrder.tableNo}</Descriptions.Item>
            )}
            {selectedOrder.remark && (
              <Descriptions.Item label="备注" span={2}>
                <Text type="warning">{selectedOrder.remark}</Text>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间" span={2}>
              {formatTime(selectedOrder.createdAt)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default OrderPage;