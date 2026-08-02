import { useState } from 'react';
import { Modal } from 'antd';
import { antdMessage as message } from '@/utils/antdApp';
import type { Order } from '@/services/order';
import {
  useCancelOrder,
  useResolveCancelRequest,
  useUpdateOrderStatus,
} from '@/hooks/queries';
import { formatPrice } from '@/utils/format';
import { isRequestErrorHandled } from '@/utils/request';

export interface UseOrderStatusActionsOptions {
  /** 变更成功后刷新详情弹窗快照 */
  refreshDetailSnapshot: (orderId: string) => Promise<void>;
  /** 用于取件退款金额提示：优先详情快照，其次当前列表 */
  findOrder: (orderId: string) => Order | undefined;
}

/**
 * 订单状态流转动作集合（含行级防重复提交）。
 */
export function useOrderStatusActions({
  refreshDetailSnapshot,
  findOrder,
}: UseOrderStatusActionsOptions) {
  /**
   * 正在流转的「行 + 目标状态」标识集合，元素格式 `${orderId}:${targetStatus}`。
   * 用集合而非单值：只锁住当前行的按钮，其他订单行仍可并行操作。
   */
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [cancelResolveSubmitting, setCancelResolveSubmitting] = useState(false);

  const updateStatusMutation = useUpdateOrderStatus();
  const cancelOrderMutation = useCancelOrder();
  const resolveCancelMutation = useResolveCancelRequest();

  const handleStatusUpdate = async (
    orderId: string,
    status: string,
    reason?: string,
    estimatedMinutes?: number,
  ) => {
    try {
      await updateStatusMutation.mutateAsync({ id: orderId, status, reason, estimatedMinutes });
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
  const handleRowStatusUpdate = async (
    orderId: string,
    status: string,
    estimatedMinutes?: number,
  ) => {
    const key = `${orderId}:${status}`;
    // 同一行已有流转在途时直接忽略，避免跨状态跳变
    if (isRowPending(orderId)) return;
    setPendingKeys((prev) => new Set(prev).add(key));
    try {
      await handleStatusUpdate(orderId, status, undefined, estimatedMinutes);
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

  const handleResolveCancelRequest = async (
    orderId: string,
    approve: boolean,
    reason?: string,
  ) => {
    const run = async () => {
      try {
        setCancelResolveSubmitting(true);
        await resolveCancelMutation.mutateAsync({ id: orderId, approve, reason });
        message.success(approve ? '已同意取消并退款' : '已拒绝取消申请');
        await refreshDetailSnapshot(orderId);
      } catch (error) {
        if (isRequestErrorHandled(error)) return;
        console.error('处理取消申请失败:', error);
      } finally {
        setCancelResolveSubmitting(false);
      }
    };

    if (!approve) {
      await run();
      return;
    }

    const target = findOrder(orderId);
    const amountText = target ? formatPrice(target.total) : '';
    Modal.confirm({
      title: '同意取消并退款？',
      content: amountText
        ? `同意后订单将关闭，已支付金额 ${amountText} 将原路退回顾客。`
        : '同意后订单将关闭，如已支付将原路退回顾客。',
      okText: '同意并退款',
      okButtonProps: { danger: true },
      cancelText: '再想想',
      onOk: run,
    });
  };

  return {
    pendingKeys,
    isRowPending,
    cancelResolveSubmitting,
    handleStatusUpdate,
    handleRowStatusUpdate,
    handleCancelOrder,
    handleResolveCancelRequest,
  };
}
