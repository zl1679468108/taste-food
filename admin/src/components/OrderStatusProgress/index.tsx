/**
 * 横向订单进度（对齐小程序 StatusTimeline）
 * 用于订单详情弹窗，替代 antd 纵向 Timeline。
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { getOrderStatusLabel } from '@/utils/constants';
import { formatTime } from '@/utils/format';
import type { Order } from '@/services/order';
import './index.less';

const DELIVERY_FLOW = [
  'pending_payment',
  'paid',
  'accepted',
  'preparing',
  'ready_for_delivery',
  'delivering',
  'completed',
] as const;

const PICKUP_FLOW = [
  'pending_payment',
  'paid',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'completed',
] as const;

type FlowStatus = string;

export interface OrderStatusProgressProps {
  order: Pick<
    Order,
    | 'status'
    | 'deliveryType'
    | 'statusHistory'
    | 'createdAt'
    | 'updatedAt'
    | 'cancelReason'
    | 'rejectReason'
  >;
}

function resolveFlow(
  deliveryType?: string,
  currentStatus?: string,
  history: Array<{ status: string }> = [],
): FlowStatus[] {
  if (deliveryType === 'delivery') return [...DELIVERY_FLOW];
  if (deliveryType === 'pickup' || deliveryType === 'dine_in') return [...PICKUP_FLOW];
  const hasPickup =
    currentStatus === 'ready_for_pickup' ||
    history.some((item) => item.status === 'ready_for_pickup');
  return hasPickup ? [...PICKUP_FLOW] : [...DELIVERY_FLOW];
}

function formatStepTime(time?: string): string {
  if (!time || time === '—' || time === '--:--') return '';
  const formatted = formatTime(time, 'MM-DD HH:mm');
  return formatted === 'Invalid Date' ? '' : formatted;
}

const OrderStatusProgress: React.FC<OrderStatusProgressProps> = ({ order }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => {
    const history = order.statusHistory || [];
    const isTerminalAbnormal = order.status === 'cancelled' || order.status === 'rejected';
    const normalFlow = resolveFlow(order.deliveryType, order.status, history);
    const allStatuses = isTerminalAbnormal
      ? [
          ...normalFlow.filter((status) => history.some((item) => item.status === status)),
          order.status,
        ]
      : normalFlow;

    const historyMap: Record<string, string> = {};
    for (const item of history) {
      if (!historyMap[item.status]) historyMap[item.status] = item.time;
    }

    let currentIndex = allStatuses.indexOf(order.status);
    if (currentIndex < 0) currentIndex = 0;
    const isCompleted = order.status === 'completed';

    return allStatuses.map((status, index) => {
      const isCurrent = !isCompleted && index === currentIndex;
      const isDone = isCompleted
        ? true
        : isTerminalAbnormal
          ? historyMap[status] !== undefined && index < currentIndex
          : index < currentIndex;
      const reached = isCompleted || index <= currentIndex;
      const time =
        formatStepTime(historyMap[status]) ||
        (index === 0
          ? formatStepTime(history[0]?.time || order.createdAt)
          : '') ||
        (isCurrent || (isCompleted && index === allStatuses.length - 1)
          ? formatStepTime(
              historyMap[order.status] ||
                history[history.length - 1]?.time ||
                order.updatedAt ||
                order.createdAt,
            )
          : '');

      const reason =
        status === 'cancelled'
          ? order.cancelReason
          : status === 'rejected'
            ? order.rejectReason
            : undefined;

      return {
        status,
        label: getOrderStatusLabel(status, order.deliveryType),
        time,
        done: isDone,
        current: isCurrent || (isCompleted && index === allStatuses.length - 1),
        reached,
        reason,
      };
    });
  }, [order]);

  const currentStepIndex = steps.findIndex((step) => step.current);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || currentStepIndex < 0) return;
    // 每步约 96px，尽量让当前节点落在可视区中部偏左
    const target = Math.max(0, (currentStepIndex - 1) * 96);
    container.scrollTo({ left: target, behavior: 'smooth' });
  }, [currentStepIndex, steps.length]);

  return (
    <div className="tf-order-progress">
      <div className="tf-order-progress__header">
        <span className="tf-order-progress__title">订单进度</span>
        <span className="tf-order-progress__hint">左右滑动</span>
      </div>
      <div className="tf-order-progress__scroll" ref={scrollRef}>
        <div className="tf-order-progress__track">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const state = step.done && !step.current ? 'done' : step.current ? 'current' : 'pending';
            const leftActive = idx > 0 && step.reached;
            const rightActive = !isLast && step.done;
            return (
              <div
                key={step.status}
                className={`tf-order-progress__step tf-order-progress__step--${state}`}
              >
                <div className="tf-order-progress__rail">
                  <span
                    className={`tf-order-progress__line tf-order-progress__line--left tf-order-progress__line--${
                      idx === 0 ? 'hidden' : leftActive ? 'active' : 'pending'
                    }`}
                  />
                  <span className={`tf-order-progress__dot tf-order-progress__dot--${state}`}>
                    {state === 'current' ? <span className="tf-order-progress__dot-core" /> : null}
                  </span>
                  <span
                    className={`tf-order-progress__line tf-order-progress__line--right tf-order-progress__line--${
                      isLast ? 'hidden' : rightActive ? 'active' : 'pending'
                    }`}
                  />
                </div>
                <span className={`tf-order-progress__label tf-order-progress__label--${state}`}>
                  {step.label}
                </span>
                <span className="tf-order-progress__time">{step.time || (step.current ? '进行中' : '')}</span>
                {step.reason ? (
                  <span className="tf-order-progress__reason" title={step.reason}>
                    {step.reason}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrderStatusProgress;
