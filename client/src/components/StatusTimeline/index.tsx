import { memo, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import { ORDER_STATUS_MAP } from '../../utils/constants';
import { formatTime } from '../../utils/format';
import './index.scss';

interface StatusTimelineProps {
  currentStatus: string;
  statusHistory: Array<{ status: string; time: string }>;
  /** delivery | pickup | dine_in；缺省时从 currentStatus/history 推断 */
  deliveryType?: string;
}

const DELIVERY_FLOW = [
  'pending_payment', 'paid', 'accepted', 'preparing', 'delivering', 'completed',
];
const PICKUP_FLOW = [
  'pending_payment', 'paid', 'accepted', 'preparing', 'ready_for_pickup', 'completed',
];

function resolveFlow(
  deliveryType?: string,
  currentStatus?: string,
  history: Array<{ status: string }> = [],
) {
  if (deliveryType === 'delivery') return DELIVERY_FLOW;
  if (deliveryType === 'pickup' || deliveryType === 'dine_in') return PICKUP_FLOW;
  const hasPickup =
    currentStatus === 'ready_for_pickup' ||
    history.some((h) => h.status === 'ready_for_pickup');
  return hasPickup ? PICKUP_FLOW : DELIVERY_FLOW;
}

function formatStepTime(time?: string) {
  if (!time || time === '—' || time === '--:--') return '';
  const formatted = formatTime(time, 'MM-DD HH:mm');
  return formatted === 'Invalid Date' ? '' : formatted;
}

function StatusTimelineInner({
  currentStatus,
  statusHistory,
  deliveryType,
}: StatusTimelineProps) {
  const steps = useMemo(() => {
    const isTerminalAbnormal =
      currentStatus === 'cancelled' || currentStatus === 'rejected';
    const normalFlow = resolveFlow(deliveryType, currentStatus, statusHistory);
    const allStatuses = isTerminalAbnormal
      ? [
          ...normalFlow.filter((s) => statusHistory.some((h) => h.status === s)),
          currentStatus,
        ]
      : normalFlow;

    const historyMap: Record<string, string> = {};
    for (const h of statusHistory) {
      historyMap[h.status] = h.time;
    }

    const result: Array<{
      status: string;
      label: string;
      time: string;
      done: boolean;
      current: boolean;
    }> = [];
    let reachedCurrent = false;

    for (const s of allStatuses) {
      const isCurrent = s === currentStatus;
      const isDone = reachedCurrent
        ? false
        : historyMap[s] !== undefined && !isCurrent;
      if (isCurrent) reachedCurrent = true;

      result.push({
        status: s,
        label: ORDER_STATUS_MAP[s] || s,
        time: formatStepTime(historyMap[s]),
        done: isDone,
        current: isCurrent,
      });
    }

    return result;
  }, [currentStatus, statusHistory, deliveryType]);

  return (
    <View className='status-timeline'>
      <Text className='status-timeline__title'>订单进度</Text>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <View key={step.status} className='status-timeline__item'>
            <View className='status-timeline__dot-col'>
              <View
                className={`status-timeline__dot status-timeline__dot--${
                  step.done ? 'done' : step.current ? 'current' : 'pending'
                }`}
              />
              {!isLast && (
                <View
                  className={`status-timeline__line status-timeline__line--${
                    step.done ? 'done' : 'pending'
                  }`}
                />
              )}
            </View>
            <View className='status-timeline__content'>
              <View className='status-timeline__label-row'>
                <Text
                  className={`status-timeline__label status-timeline__label--${
                    step.done ? 'done' : step.current ? 'current' : 'pending'
                  }`}
                >
                  {step.label}
                </Text>
                {step.current && (
                  <Text className='status-timeline__badge'>当前</Text>
                )}
              </View>
              <Text className='status-timeline__time'>
                {step.time || (step.current ? '进行中' : '未开始')}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default memo(StatusTimelineInner);
