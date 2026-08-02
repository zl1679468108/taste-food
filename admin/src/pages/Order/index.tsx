import React, { useState } from 'react';
import { Table, Button } from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import { DownloadOutlined, ShoppingOutlined } from '@ant-design/icons';
import { forceCompleteOrder, Order } from '@/services/order';
import { useOrders } from '@/hooks/queries';
import { useShopContext } from '@/hooks/useShopContext';
import { DEFAULT_PAGE_SIZE, DEFAULT_TABLE_LOCALE } from '@/utils/table';
import PageHeaderActions from '@/components/PageHeaderActions';
import TableCard from '@/components/TableCard';
import SearchFilterBar from '@/components/SearchFilterBar';
import { buildOrderColumns } from './columns';
import OrderStatusTabs from './components/OrderStatusTabs';
import OrderDetailModal from './components/OrderDetailModal';
import OrderReasonModal from './components/OrderReasonModal';
import OrderAcceptModal from './components/OrderAcceptModal';
import { useOrderExport } from './hooks/useOrderExport';
import { useOrderDetail } from './hooks/useOrderDetail';
import { useOrderStatusActions } from './hooks/useOrderStatusActions';
import { useOrderStatusBadges } from './hooks/useOrderStatusBadges';
import { useReasonModal } from './hooks/useReasonModal';
import { useAcceptModal } from './hooks/useAcceptModal';

const OrderPage: React.FC = () => {
  const { shopId, ready, currentShop, scope, canSwitchShops } = useShopContext();
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [keyword, setKeyword] = useState('');

  // 平台管理员全店视角：跨店查询所有门店订单；商家端恒为单店（必传 shopId）
  const allShops = canSwitchShops && scope === 'all';
  const effectiveShopId = ready && shopId ? shopId : '';

  const ordersQuery = useOrders({
    shopId: effectiveShopId,
    allShops,
    status: activeTab || undefined,
    page,
    pageSize,
    keyword: keyword || undefined,
  });
  const orders = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const loading = ordersQuery.isPending;

  const { exporting, handleExport } = useOrderExport({
    shopId,
    status: activeTab || undefined,
  });

  const { detailVisible, detailLoading, selectedOrder, openDetail, closeDetail, refreshDetailSnapshot } =
    useOrderDetail(ready);

  /** 退款金额提示的数据来源：优先详情快照，其次当前列表 */
  const findOrder = (orderId: string): Order | undefined =>
    (selectedOrder?.id === orderId ? selectedOrder : orders.find((item) => item.id === orderId)) ??
    undefined;

  const {
    pendingKeys,
    isRowPending,
    cancelResolveSubmitting,
    handleStatusUpdate,
    handleRowStatusUpdate,
    handleCancelOrder,
    handleResolveCancelRequest,
  } = useOrderStatusActions({ refreshDetailSnapshot, findOrder });

  const orderStatusBadges = useOrderStatusBadges({
    ready,
    shopId,
    onNewOrder: () => {
      ordersQuery.refetch();
    },
  });

  const reasonModal = useReasonModal();
  const acceptModal = useAcceptModal();

  const submitReasonModal = () =>
    reasonModal.submit(async ({ orderId, mode, reason }) => {
      if (mode === 'cancel') {
        await handleCancelOrder(orderId, reason);
      } else if (mode === 'force') {
        await forceCompleteOrder(orderId, reason);
        message.success('已强制完成');
        await refreshDetailSnapshot(orderId);
      } else if (mode === 'cancel_request_reject') {
        await handleResolveCancelRequest(orderId, false, reason);
      } else {
        await handleStatusUpdate(orderId, 'rejected', reason);
      }
    });

  const submitAcceptModal = () =>
    acceptModal.submit(({ orderId, targetStatus, estimatedMinutes }) =>
      handleRowStatusUpdate(orderId, targetStatus, estimatedMinutes),
    );

  /** 搜索时重置到第一页 */
  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  /** 清空搜索 */
  const handleSearchClear = () => {
    setKeyword('');
    setPage(1);
  };

  const columns = buildOrderColumns({
    pendingKeys,
    isRowPending,
    onViewDetail: openDetail,
    onOpenReason: reasonModal.open,
    onOpenAccept: acceptModal.open,
    onRowStatusUpdate: handleRowStatusUpdate,
  });

  return (
    <div className="tf-page">
      <PageHeaderActions
        icon={<ShoppingOutlined style={{ marginRight: 'var(--tf-space-2)' }} />}
        title={allShops ? '订单管理 · 全店' : (currentShop?.name ? `订单管理 · ${currentShop.name}` : '订单管理')}
        onRefresh={() => ordersQuery.refetch()}
        extra={
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            后台导出 Excel
          </Button>
        }
      />

      <TableCard>
        <OrderStatusTabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setPage(1);
            setKeyword('');
          }}
          badges={orderStatusBadges}
        />

        <SearchFilterBar
          searchPlaceholder="搜索订单号/联系人/电话"
          onSearch={handleSearch}
          onSearchClear={handleSearchClear}
        />

        <Table
          columns={columns}
          dataSource={orders}
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

      <OrderDetailModal
        open={detailVisible}
        loading={detailLoading}
        order={selectedOrder}
        cancelResolveSubmitting={cancelResolveSubmitting}
        onClose={closeDetail}
        onApproveCancelRequest={(orderId) => handleResolveCancelRequest(orderId, true)}
        onRejectCancelRequest={(orderId) => reasonModal.open(orderId, 'cancel_request_reject')}
      />

      <OrderReasonModal
        state={reasonModal.state}
        form={reasonModal.form}
        submitting={reasonModal.submitting}
        onCancel={reasonModal.close}
        onOk={submitReasonModal}
      />

      <OrderAcceptModal
        state={acceptModal.state}
        form={acceptModal.form}
        submitting={acceptModal.submitting}
        onCancel={acceptModal.close}
        onOk={submitAcceptModal}
      />
    </div>
  );
};

export default OrderPage;
