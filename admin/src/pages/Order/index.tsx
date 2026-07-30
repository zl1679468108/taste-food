import React, { useMemo, useState } from 'react';
import { Table, Button, Typography, Tabs, Modal, Descriptions, message, Space, Spin, Input, Form, Timeline } from 'antd';
import { EyeOutlined, DownloadOutlined, ShoppingOutlined } from '@ant-design/icons';
import {
  getOrder,
  exportOrders,
  Order,
  OrderExportResult,
} from '@/services/order';
import { useOrders, useUpdateOrderStatus, useCancelOrder } from '@/hooks/queries';
import DeliveryTypeTag from '@/components/DeliveryTypeTag';
import OrderStatusTag from '@/components/OrderStatusTag';
import PriceDisplay from '@/components/PriceDisplay';
import RiderLocationPanel from '@/components/RiderLocationPanel';
import { formatPrice, formatTime, shortOrderId } from '@/utils/format';
import {
  parseCsvLine,
  parseCsv,
  csvToExcelHtmlBlob,
  base64ToBlob,
  ensureExcelFilename,
  downloadBlob,
  buildExportBlob,
} from '@/utils/export';
import { useShopContext } from '@/hooks/useShopContext';
import { isRequestErrorHandled } from '@/utils/request';
import { DEFAULT_PAGE_SIZE, DEFAULT_TABLE_LOCALE, filterByKeyword } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { brand } from '@/theme';
import { getOrderStatusActions } from '@taste-food/shared';

const { Text } = Typography;

/** 优先业务单号，否则短 id */
function displayOrderNo(order: Pick<Order, 'id' | 'orderNo' | 'order_no'>): string {
  return order.orderNo || order.order_no || shortOrderId(order.id);
}

const DELIVERY_FLOW = ['pending_payment', 'paid', 'accepted', 'preparing', 'delivering', 'completed'];
const PICKUP_FLOW = ['pending_payment', 'paid', 'accepted', 'preparing', 'ready_for_pickup', 'completed'];

const STATUS_LABEL: Record<string, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  accepted: '已接单',
  preparing: '制作中',
  ready_for_pickup: '待取餐',
  delivering: '配送中',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已拒单',
};

type FlowSequence = string[];

function resolveFlow(deliveryType?: string, currentStatus?: string, history: Order['statusHistory'] = []): FlowSequence {
  if (deliveryType === 'delivery') return DELIVERY_FLOW;
  if (deliveryType === 'pickup' || deliveryType === 'dine_in') return PICKUP_FLOW;
  const hasPickup = currentStatus === 'ready_for_pickup' || history.some((h) => h.status === 'ready_for_pickup');
  return hasPickup ? PICKUP_FLOW : DELIVERY_FLOW;
}

function getStatusLabel(status: string, deliveryType?: string) {
  if (status === 'ready_for_pickup') return '待取餐';
  if (status === 'delivering' && deliveryType === 'delivery') return '配送中';
  return STATUS_LABEL[status] || status;
}

function renderStatusTimeline(order: Order) {
  const history = order.statusHistory || [];
  const flow = resolveFlow(order.deliveryType, order.status, history);
  const isTerminalAbnormal = order.status === 'cancelled' || order.status === 'rejected';

  let sequence: FlowSequence;
  if (isTerminalAbnormal) {
    sequence = [...flow.filter((s) => history.some((h) => h.status === s)), order.status];
  } else {
    sequence = flow;
  }

  const historyMap: Record<string, string> = {};
  for (const h of history) {
    if (!historyMap[h.status]) historyMap[h.status] = h.time;
  }

  const currentIndex = sequence.indexOf(order.status);
  const normalisedCurrentIndex = currentIndex < 0 ? 0 : currentIndex;
  const isCompleted = order.status === 'completed';

  return sequence.map((s, index) => {
    const isCurrent = !isCompleted && index === normalisedCurrentIndex;
    const isDone = isCompleted ? true : isTerminalAbnormal ? historyMap[s] !== undefined && index < normalisedCurrentIndex : index < normalisedCurrentIndex;
    const effectiveTime =
      historyMap[s] ||
      (index === 0 ? history[0]?.time || order.createdAt : '') ||
      (isCurrent || (isCompleted && index === sequence.length - 1)
        ? historyMap[order.status] || history[history.length - 1]?.time || order.updatedAt || order.createdAt
        : '');

    return {
      status: s,
      label: getStatusLabel(s, order.deliveryType),
      time: effectiveTime,
      isCurrent,
      isDone,
      reason: s === 'cancelled' ? order.cancelReason : s === 'rejected' ? order.rejectReason : undefined,
    };
  });
}

// 以下导出相关工具函数已抽离至 @/utils/export.ts：
// parseCsvLine, parseCsv, csvToExcelHtmlBlob, base64ToBlob, ensureExcelFilename, downloadBlob, buildExportBlob

const OrderPage: React.FC = () => {
  const { shopId, ready, currentShop } = useShopContext();
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [keyword, setKeyword] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reasonModal, setReasonModal] = useState<{
    open: boolean;
    orderId: string;
    mode: 'cancel' | 'reject';
    title: string;
  } | null>(null);
  const [reasonForm] = Form.useForm<{ reason: string }>();
  const [reasonSubmitting, setReasonSubmitting] = useState(false);
  /**
   * 正在流转的「行 + 目标状态」标识集合，元素格式 `${orderId}:${targetStatus}`。
   * 用集合而非单值：只锁住当前行的按钮，其他订单行仍可并行操作。
   */
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const ordersQuery = useOrders({
    shopId: ready && shopId ? shopId : '',
    status: activeTab || undefined,
    page,
    pageSize,
  });
  const orders = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const loading = ordersQuery.isPending;

  const updateStatusMutation = useUpdateOrderStatus();
  const cancelOrderMutation = useCancelOrder();

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportOrders({
        shop_id: shopId,
        status: activeTab || undefined,
        maxRows: 1000,
      });
      const { blob, filename } = buildExportBlob(data);
      downloadBlob(blob, filename);
      message.success(`已导出 ${data.count ?? 0} 条订单`);
    } catch (e) {
      console.error('导出订单失败:', e);
    } finally {
      setExporting(false);
    }
  };

  const handleViewDetail = async (order: Order) => {
    setSelectedOrder(order);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const fullOrder = await getOrder(order.id);
      setSelectedOrder(fullOrder);
    } catch (error) {
      console.error('加载订单详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  /** 变更后刷新弹窗内的详情快照（列表由 mutation 内部 invalidate 处理） */
  const refreshDetailSnapshot = async (orderId: string) => {
    if (selectedOrder?.id !== orderId) return;
    try {
      const fresh = await getOrder(orderId);
      setSelectedOrder(fresh);
    } catch {
      // ignore
    }
  };

  const handleStatusUpdate = async (orderId: string, status: string, reason?: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id: orderId, status, reason });
      message.success(status === 'rejected' ? '已拒单' : '状态更新成功');
      await refreshDetailSnapshot(orderId);
    } catch (error) {
      // 重复提交被请求层拦截属正常行为，不记为失败
      if (isRequestErrorHandled(error)) return;
      console.error('状态更新失败:', error);
    }
  };

  /** 该订单行是否有流转在途 */
  const isRowPending = (orderId: string) =>
    Array.from(pendingKeys).some((k) => k.startsWith(`${orderId}:`));

  /** 行内状态流转：按 `orderId:targetStatus` 上锁，同一行同时只允许一个流转 */
  const handleRowStatusUpdate = async (orderId: string, status: string) => {
    const key = `${orderId}:${status}`;
    // 同一行已有流转在途时直接忽略，避免跨状态跳变
    if (isRowPending(orderId)) return;
    setPendingKeys((prev) => new Set(prev).add(key));
    try {
      await handleStatusUpdate(orderId, status);
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleCancelOrder = async (orderId: string, reason: string) => {
    try {
      await cancelOrderMutation.mutateAsync({ id: orderId, reason });
      message.success('订单已取消');
      await refreshDetailSnapshot(orderId);
    } catch (error) {
      if (isRequestErrorHandled(error)) return;
      console.error('取消订单失败:', error);
    }
  };

  const openReasonModal = (orderId: string, mode: 'cancel' | 'reject') => {
    setReasonModal({
      open: true,
      orderId,
      mode,
      title: mode === 'reject' ? '拒单原因' : '取消原因',
    });
    reasonForm.resetFields();
  };

  const submitReasonModal = async () => {
    if (!reasonModal) return;
    try {
      const values = await reasonForm.validateFields();
      const reason = values.reason.trim();
      setReasonSubmitting(true);
      if (reasonModal.mode === 'cancel') {
        await handleCancelOrder(reasonModal.orderId, reason);
      } else {
        await handleStatusUpdate(reasonModal.orderId, 'rejected', reason);
      }
      setReasonModal(null);
      reasonForm.resetFields();
    } catch (error) {
      // 校验失败或接口失败，保持弹窗
      if (error && typeof error === 'object' && 'errorFields' in (error as object)) {
        return;
      }
      console.error('提交原因失败:', error);
    } finally {
      setReasonSubmitting(false);
    }
  };

  const getAvailableActions = (order: Order) => getOrderStatusActions(order.status, order.deliveryType);
  const filteredOrders = useMemo(() => {
    return filterByKeyword(orders, keyword, [
      'id',
      'orderNo',
      'order_no',
      (o) => displayOrderNo(o),
      'contactName',
      'contactPhone',
      'tableNo',
      'address',
      'remark',
    ]);
  }, [orders, keyword]);

  const columns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (_: string, record: Order) => (
        <Text strong style={{ fontFamily: 'monospace' }}>
          {displayOrderNo(record)}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string, record: Order) => (
        <OrderStatusTag status={status} deliveryType={record.deliveryType} />
      ),
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
      render: (time: string) => formatTime(time),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right' as const,
      render: (_: Order, record: Order) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {getAvailableActions(record).map((action) => {
            const actionKey = `${record.id}:${action.status}`;
            const isSelfPending = pendingKeys.has(actionKey);
            // 仅锁「同一行」的其他按钮，不影响其他订单行
            const isRowLocked = !isSelfPending && isRowPending(record.id);

            return action.cancel || action.status === 'rejected' ? (
              <Button
                key={action.status}
                type="link"
                danger
                disabled={isRowLocked}
                onClick={() =>
                  openReasonModal(record.id, action.cancel ? 'cancel' : 'reject')
                }
              >
                {action.label}
              </Button>
            ) : (
              <Button
                key={action.status}
                type="link"
                danger={action.type === 'danger'}
                loading={isSelfPending}
                disabled={isRowLocked}
                onClick={() => handleRowStatusUpdate(record.id, action.status)}
              >
                {action.label}
              </Button>
            );
          })}
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
    { key: 'ready_for_pickup', label: '待取餐' },
    { key: 'delivering', label: '配送中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
    { key: 'rejected', label: '已拒单' },
  ];

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<ShoppingOutlined style={{ marginRight: 8 }} />}
        title={currentShop?.name ? `订单管理 · ${currentShop.name}` : '订单管理'}
        onRefresh={() => ordersQuery.refetch()}
        extra={
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            导出 Excel
          </Button>
        }
      />

      <TableCard>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setPage(1);
            setKeyword('');
          }}
          items={tabItems}
          style={{ marginBottom: 8 }}
        />

        <SearchFilterBar
          searchPlaceholder="搜索订单号/联系人/电话"
          onSearch={setKeyword}
          onSearchClear={() => setKeyword('')}
        />

        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          size="small"
          locale={DEFAULT_TABLE_LOCALE}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            total,
            pageSize,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (totalCount) => `共 ${totalCount} 条`,
          }}
        />
      </TableCard>

      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={720}
        destroyOnClose
      >
        <Spin spinning={detailLoading}>
          {selectedOrder && (
            <>
              <Descriptions
                column={2}
                bordered
                size="middle"
                labelStyle={{ width: 110, whiteSpace: 'nowrap' }}
                contentStyle={{ background: brand.bgCard }}
              >
                <Descriptions.Item label="订单号">
                  <Text
                    strong
                    copyable
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayOrderNo(selectedOrder)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <OrderStatusTag status={selectedOrder.status} deliveryType={selectedOrder.deliveryType} />
                </Descriptions.Item>
                <Descriptions.Item label="配送方式">
                  <DeliveryTypeTag type={selectedOrder.deliveryType} />
                </Descriptions.Item>
                <Descriptions.Item label="金额">
                  <Text strong style={{ color: brand.textPrice, fontSize: 16, whiteSpace: 'nowrap' }}>
                    {formatPrice(selectedOrder.total)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间" span={2} contentStyle={{ whiteSpace: 'nowrap' }}>
                  {formatTime(selectedOrder.createdAt)}
                </Descriptions.Item>
              </Descriptions>

              {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 ? (
                <Timeline
                  items={renderStatusTimeline(selectedOrder).map((step) => ({
                    color: step.isCurrent ? 'green' : step.isDone ? 'blue' : 'gray',
                    children: (
                      <div>
                        <Text strong={step.isCurrent}>{step.label}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {step.time ? formatTime(step.time) : step.isCurrent ? '进行中' : ''}
                        </Text>
                        {step.reason ? (
                          <>
                            <br />
                            <Text type="danger" style={{ fontSize: 12 }}>
                              {step.reason}
                            </Text>
                          </>
                        ) : null}
                      </div>
                    ),
                  }))}
                  style={{ margin: '4px 0 12px' }}
                />
              ) : null}

              {selectedOrder.deliveryType === 'delivery' && selectedOrder.status === 'delivering' ? (
                <RiderLocationPanel order={selectedOrder} />
              ) : null}

              <Descriptions
                column={2}
                bordered
                size="middle"
                labelStyle={{ width: 110, whiteSpace: 'nowrap' }}
                contentStyle={{ background: brand.bgCard }}
              >
                <Descriptions.Item label="商品" span={2}>
                  {selectedOrder.items?.length
                    ? selectedOrder.items.map((item) => `${item.name} x${item.quantity}`).join('、')
                    : '-'}
                </Descriptions.Item>
                {selectedOrder.address ? (
                  <Descriptions.Item label="地址" span={2}>{selectedOrder.address}</Descriptions.Item>
                ) : null}
                {selectedOrder.tableNo ? (
                  <Descriptions.Item label="桌号">{selectedOrder.tableNo}</Descriptions.Item>
                ) : null}
                {selectedOrder.contactName ? (
                  <Descriptions.Item label="联系人">{selectedOrder.contactName}</Descriptions.Item>
                ) : null}
                {selectedOrder.contactPhone ? (
                  <Descriptions.Item label="联系电话" contentStyle={{ whiteSpace: 'nowrap' }}>
                    {selectedOrder.contactPhone}
                  </Descriptions.Item>
                ) : null}
                {/* 单列字段奇数个时补空位，避免后续 span=2 被挤到右半边出现空白行 */}
                {([selectedOrder.tableNo, selectedOrder.contactName, selectedOrder.contactPhone].filter(Boolean).length % 2 === 1) ? (
                  <Descriptions.Item label=" ">{' '}</Descriptions.Item>
                ) : null}
                {selectedOrder.remark ? (
                  <Descriptions.Item label="备注" span={2}>
                    <Text type="warning">{selectedOrder.remark}</Text>
                  </Descriptions.Item>
                ) : null}
                {selectedOrder.cancelReason ? (
                  <Descriptions.Item label="取消原因" span={2}>
                    <Text type="danger">{selectedOrder.cancelReason}</Text>
                  </Descriptions.Item>
                ) : null}
                {selectedOrder.rejectReason ? (
                  <Descriptions.Item label="拒单原因" span={2}>
                    <Text type="danger">{selectedOrder.rejectReason}</Text>
                  </Descriptions.Item>
                ) : null}
                {selectedOrder.invoiceNeeded ? (
                  <Descriptions.Item label="发票" span={2}>
                    <Text>
                      需要开票
                      {selectedOrder.invoiceTitle ? ` · 抬头：${selectedOrder.invoiceTitle}` : ''}
                      {selectedOrder.invoiceTaxNo ? ` · 税号：${selectedOrder.invoiceTaxNo}` : ''}
                    </Text>
                  </Descriptions.Item>
                ) : null}
              </Descriptions>
            </>
          )}
        </Spin>
      </Modal>

      <Modal
        title={reasonModal?.title || '填写原因'}
        open={!!reasonModal?.open}
        onCancel={() => {
          if (reasonSubmitting) return;
          setReasonModal(null);
          reasonForm.resetFields();
        }}
        onOk={submitReasonModal}
        okText={reasonModal?.mode === 'reject' ? '确认拒单' : '确认取消'}
        cancelText="再想想"
        okButtonProps={{ danger: true, loading: reasonSubmitting }}
        destroyOnClose
      >
        <Form form={reasonForm} layout="vertical" requiredMark>
          <Form.Item
            name="reason"
            label="原因"
            rules={[
              { required: true, message: '请填写原因' },
              { whitespace: true, message: '请填写原因' },
              { min: 2, message: '原因至少 2 个字' },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={200}
              showCount
              placeholder={
                reasonModal?.mode === 'reject'
                  ? '请填写拒单原因（必填）'
                  : '请填写取消原因（必填）'
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OrderPage;
