import { useEffect, useState } from 'react';
import { antdMessage as message } from '@/utils/antdApp';
import { useLocation } from '@umijs/max';
import { getOrder, Order } from '@/services/order';

/**
 * 订单详情弹窗状态：打开/关闭、详情加载、变更后刷新快照，
 * 以及消息/铃铛深链 `/order?orderId=xxx` 直接打开详情。
 */
export function useOrderDetail(ready: boolean) {
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const openDetail = async (order: Order) => {
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

  const closeDetail = () => setDetailVisible(false);

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

  /** 消息/铃铛深链：/order?orderId=xxx 直接打开详情弹窗 */
  const location = useLocation();
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(location.search || '');
    const orderId = params.get('orderId')?.trim();
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      setDetailVisible(true);
      setDetailLoading(true);
      setSelectedOrder(null);
      try {
        const fullOrder = await getOrder(orderId);
        if (!cancelled) setSelectedOrder(fullOrder);
      } catch (error) {
        console.error('深链加载订单失败:', error);
        if (!cancelled) {
          setDetailVisible(false);
          setSelectedOrder(null);
          message.warning('订单不存在或无权访问');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.search, ready]);

  return {
    detailVisible,
    detailLoading,
    selectedOrder,
    openDetail,
    closeDetail,
    refreshDetailSnapshot,
  };
}
