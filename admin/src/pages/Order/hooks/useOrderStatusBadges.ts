import { useEffect, useRef, useState } from 'react';
import { getOrderStatusCounts, OrderStatusCounts } from '@/services/order';
import {
  connectSocket,
  disconnectSocket,
  offOrderNew,
  onOrderNew,
  OrderNewEvent,
} from '@/services/socket';

/**
 * 需要展示角标的订单状态 Tab。
 * - paid: 已支付（待接单）
 * - ready_for_delivery: 待配送（外卖出餐待骑手接单）
 * - ready_for_pickup: 待取餐（自取/堂食已出餐待确认）
 * - refund: 退款售后（顾客已申请取消、商家未处理）
 */
const BADGE_KEYS: (keyof OrderStatusCounts)[] = [
  'paid',
  'ready_for_delivery',
  'ready_for_pickup',
  'refund',
];

export type OrderStatusBadges = Record<string, number>;

/**
 * 本店各状态 Tab 的实时角标数量。
 * 订阅 WS 新单事件重新拉取，并 30s 轮询兜底，保证状态流转后角标及时更新。
 * v34 改为单次聚合接口 GET /api/orders/counts，替代原来 4 次按状态查列表。
 */
export function useOrderStatusBadges(options: {
  ready: boolean;
  shopId: string;
  /** 收到本店新单后刷新订单列表 */
  onNewOrder?: () => void;
}): OrderStatusBadges {
  const { ready, shopId } = options;
  const [badges, setBadges] = useState<OrderStatusBadges>({});
  // 回调每次渲染都是新引用，用 ref 持有最新值，避免把它塞进 effect deps 反复重连
  const onNewOrderRef = useRef(options.onNewOrder);
  onNewOrderRef.current = options.onNewOrder;

  useEffect(() => {
    if (!ready || !shopId) return;

    /** 拉取各状态 Tab 的总数 */
    const fetchAll = async (targetShopId: string) => {
      try {
        const counts = await getOrderStatusCounts({ shop_id: targetShopId });
        const entries = BADGE_KEYS.map((key) => [key, counts[key] || 0] as const);
        setBadges(Object.fromEntries(entries));
      } catch {
        // 拉取失败保持原值，不影响主流程
      }
    };

    connectSocket();
    const onNew = (data: OrderNewEvent) => {
      const nested = (data.order || {}) as Record<string, unknown>;
      const evtShopId = String(data.shopId || nested.shop_id || '');
      // 仅统计本店铺新单
      if (evtShopId && evtShopId !== String(shopId)) return;
      void fetchAll(shopId);
      onNewOrderRef.current?.();
    };
    onOrderNew(onNew);
    void fetchAll(shopId);

    // 轮询兜底：状态流转（接单/出餐/取餐/处理售后）后角标及时更新
    const timer = setInterval(() => void fetchAll(shopId), 30_000);

    return () => {
      offOrderNew(onNew);
      disconnectSocket();
      clearInterval(timer);
    };
  }, [ready, shopId]);

  return badges;
}
