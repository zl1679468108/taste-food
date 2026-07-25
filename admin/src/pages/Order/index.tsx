import React, { useEffect, useState } from 'react';
import { Table, Button, Typography, Tabs, Modal, Descriptions, message, Space, Card, Tag, Spin, Popconfirm } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import {EyeOutlined, ReloadOutlined, DownloadOutlined, OrderedListOutlined, ShoppingOutlined} from '@ant-design/icons';
import { getOrders, getOrder, updateOrderStatus, cancelOrder, exportOrders, Order } from '@/services/order';
import DeliveryTypeTag from '@/components/DeliveryTypeTag';
import OrderStatusTag from '@/components/OrderStatusTag';
import PriceDisplay from '@/components/PriceDisplay';
import { formatPrice, formatTime, shortOrderId } from '@/utils/format';
import { DEFAULT_SHOP_ID } from '@/utils/constants';
import { DEFAULT_TABLE_LOCALE } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';

const { Title, Text } = Typography;

const OrderPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [activeTab, page]);


  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportOrders({
        status: activeTab || undefined,
        maxRows: 1000,
      });
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'orders.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success(`已导出 ${data.count} 条订单`);
    } catch (e: any) {
      message.error(e?.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: { shop_id: string; status?: string; page: number; pageSize: number } = {
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
      message.error('加载订单失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (order: Order) => {
    // 先用列表数据快速展示，再异步加载完整详情（含 items 数组）
    setSelectedOrder(order);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const fullOrder = await getOrder(order.id);
      setSelectedOrder(fullOrder);
    } catch (error) {
      // 列表数据已展示，详情加载失败不阻塞
      console.error('加载订单详情失败:', error);
      message.error('加载订单详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(orderId, status);
      message.success('状态更新成功');
      loadOrders();
      // 同步刷新详情 Modal 中的订单数据
      if (selectedOrder?.id === orderId) {
        try {
          const fresh = await getOrder(orderId);
          setSelectedOrder(fresh);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder(orderId);
      message.success('订单已取消');
      loadOrders();
      if (selectedOrder?.id === orderId) {
        try {
          const fresh = await getOrder(orderId);
          setSelectedOrder(fresh);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      message.error('取消订单失败');
    }
  };

  const getAvailableActions = (order: Order) => {
    const actions: { label: string; status: string; type: 'primary' | 'danger'; cancel?: boolean }[] = [];

    switch (order.status) {
      case 'pending_payment':
        actions.push({ label: '取消订单', status: 'cancelled', type: 'danger', cancel: true });
        break;
      case 'paid':
        actions.push({ label: '接单', status: 'accepted', type: 'primary' });
        actions.push({ label: '拒单', status: 'rejected', type: 'danger' });
        actions.push({ label: '取消订单', status: 'cancelled', type: 'danger', cancel: true });
        break;
      case 'accepted':
        actions.push({ label: '开始制作', status: 'preparing', type: 'primary' });
        // 服务端 cancel 仅允许 pending_payment/paid，accepted 不展示取消
        break;
      case 'preparing':
        if (order.deliveryType === 'delivery') {
          actions.push({ label: '开始配送（商家）', status: 'delivering', type: 'primary' });
        } else {
          // 自取/堂食统一：preparing → ready_for_pickup → completed
          actions.push({ label: '待取餐（制作完成）', status: 'ready_for_pickup', type: 'primary' });
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
      width: 120,
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
      width: 110,
      render: (status: string) => <OrderStatusTag status={status} />,
    },
    {
      title: '配送方式',
      dataIndex: 'deliveryType',
      key: 'deliveryType',
      width: 110,
      render: (type: string) => <DeliveryTypeTag type={type} />,
    },
    {
      title: '金额',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      render: (total: number) => <PriceDisplay price={total} />,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (time: string) => formatTime(time, 'MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_: Order, record: Order) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {getAvailableActions(record).map(action => (
            action.cancel ? (
              <Popconfirm
                key={action.status}
                title="确认取消该订单？"
                description="取消后不可恢复，已支付订单将进入退款流程"
                okText="确认取消"
                cancelText="再想想"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleCancelOrder(record.id)}
              >
                <Button type="link" danger>
                  {action.label}
                </Button>
              </Popconfirm>
            ) : (
              <Button
                key={action.status}
                type="link"
                danger={action.type === 'danger'}
                onClick={() => handleStatusUpdate(record.id, action.status)}
              >
                {action.label}
              </Button>
            )
          ))}
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: '', label: '全部' },
    { key: 'pending_payment', label: '待支付' },
    { key: 'paid', label: '已支付' },
    { key: 'accepted', label: '已接单' },
    { key: 'preparing', label: '制作中' },
    { key: 'ready_for_pickup', label: '待自取' },
    { key: 'delivering', label: '配送中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
    { key: 'rejected', label: '已拒单' },
  ];

  return (
    <PageContainer title="订单管理" subTitle="接单、制作与配送状态流转">
    <div>
      <PageHeaderActions
      icon={<ShoppingOutlined style={{ marginRight: 8 }} />}
      title="订单管理"
      onRefresh={loadOrders}
      extra={
        <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
          导出 CSV
        </Button>
      }
    />

      <TableCard>
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
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 840 }}
          pagination={{
            current: page,
            total,
            pageSize: 10,
            onChange: setPage,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </TableCard>

      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={selectedOrder ? (
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            {getAvailableActions(selectedOrder).map(action => (
              action.cancel ? (
                <Popconfirm
                  key={action.status}
                  title="确认取消该订单？"
                  description="取消后不可恢复，已支付订单将进入退款流程"
                  okText="确认取消"
                  cancelText="再想想"
                  okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    await handleCancelOrder(selectedOrder.id);
                  }}
                >
                  <Button danger>{action.label}</Button>
                </Popconfirm>
              ) : (
                <Button
                  key={action.status}
                  type={action.type === 'primary' ? 'primary' : 'default'}
                  danger={action.type === 'danger'}
                  onClick={() => handleStatusUpdate(selectedOrder.id, action.status)}
                >
                  {action.label}
                </Button>
              )
            ))}
          </Space>
        ) : null}
        width={600}
      >
        <Spin spinning={detailLoading}>
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
              <DeliveryTypeTag type={selectedOrder.deliveryType} />
            </Descriptions.Item>
            <Descriptions.Item label="金额">
              <Text strong style={{ color: '#f5222d', fontSize: 16 }}>
                {formatPrice(selectedOrder.total)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="商品" span={2}>
              {selectedOrder.items?.length
                ? selectedOrder.items.map(item =>
                    `${item.name} x${item.quantity}`
                  ).join('、')
                : '-'}
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
            {selectedOrder.invoiceNeeded && (
              <Descriptions.Item label="发票" span={2}>
                <Text>
                  需要开票
                  {selectedOrder.invoiceTitle
                    ? ` · 抬头：${selectedOrder.invoiceTitle}`
                    : ''}
                  {selectedOrder.invoiceTaxNo
                    ? ` · 税号：${selectedOrder.invoiceTaxNo}`
                    : ''}
                </Text>
              </Descriptions.Item>
            )}
            {selectedOrder.contactName && (
              <Descriptions.Item label="联系人">{selectedOrder.contactName}</Descriptions.Item>
            )}
            {selectedOrder.contactPhone && (
              <Descriptions.Item label="联系电话">{selectedOrder.contactPhone}</Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间" span={2}>
              {formatTime(selectedOrder.createdAt)}
            </Descriptions.Item>
          </Descriptions>
        )}
        </Spin>
      </Modal>
    </div>
    </PageContainer>
  );
};

export default OrderPage;
