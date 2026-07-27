import { memo, useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { getOrderStatusLabel } from '../../utils/constants';
import { formatTime } from '../../utils/format';
import './index.scss';

interface StatusTimelineProps {
  currentStatus: string;
  statusHistory: Array<{ status: string; time: string }>;
  /** delivery | pickup | dine_in；缺省时从 currentStatus/history 推断 */
  deliveryType?: string;
  /** 展示在标题旁的辅助文案，如“下单时间” */
  subtitle?: string;
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
  subtitle,
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

    // 按流程位置推断进度：当前及之前的节点视为已到达（不依赖残缺 history）
    let currentIndex = allStatuses.indexOf(currentStatus);
    if (currentIndex < 0) currentIndex = 0;
    const isCompleted = currentStatus === 'completed';

    return allStatuses.map((s, index) => {
      const isCurrent = !isCompleted && index === currentIndex;
      const isDone = isCompleted
        ? true
        : isTerminalAbnormal
          ? historyMap[s] !== undefined && index < currentIndex
          : index < currentIndex;
      const time =
        formatStepTime(historyMap[s]) ||
        // 已完成路径：首节点用下单时间兜底
        (index === 0 ? formatStepTime(statusHistory[0]?.time) : '') ||
        // 当前节点：用最新 history 时间
        (isCurrent || (isCompleted && index === allStatuses.length - 1)
          ? formatStepTime(historyMap[currentStatus] || statusHistory[statusHistory.length - 1]?.time)
          : '');

      return {
        status: s,
        label: getOrderStatusLabel(s, deliveryType),
        time,
        done: isDone,
        current: isCurrent || (isCompleted && index === allStatuses.length - 1),
        reached: isCompleted || index <= currentIndex,
      };
    });
  }, [currentStatus, statusHistory, deliveryType]);

  const currentStepIndex = steps.findIndex((s) => s.current);
  // 让当前节点尽量滚入可视区：每步约 76px
  const scrollLeft = Math.max(0, (currentStepIndex - 1) * 76);

  return (
    <View className='status-timeline'>
      <View className='status-timeline__header'>
        <View className='status-timeline__heading'>
          <Text className='status-timeline__title'>订单进度</Text>
          {subtitle ? (
            <Text className='status-timeline__subtitle'>{subtitle}</Text>
          ) : null}
        </View>
        <Text className='status-timeline__hint'>左右滑动</Text>
      </View>
      <ScrollView
        className='status-timeline__scroll'
        scrollX
        enhanced
        showScrollbar={false}
        enableFlex
        scrollLeft={scrollLeft}
        scrollWithAnimation
      >
        <View className='status-timeline__track'>
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const state = step.done && !step.current
              ? 'done'
              : step.current
                ? 'current'
                : 'pending';
            // 橙色衔接：已到达节点的左侧连线、已完成节点的右侧连线
            const leftActive = idx > 0 && step.reached;
            const rightActive = !isLast && step.done;
            return (
              <View key={step.status} className={`status-timeline__step status-timeline__step--${state}`}>
                <View className='status-timeline__rail'>
                  <View
                    className={`status-timeline__line status-timeline__line--left status-timeline__line--${
                      idx === 0 ? 'hidden' : leftActive ? 'active' : 'pending'
                    }`}
                  />
                  <View className={`status-timeline__dot status-timeline__dot--${state}`}>
                    {(step.current || (step.done && isLast)) ? (
                      <View className='status-timeline__dot-core' />
                    ) : null}
                  </View>
                  <View
                    className={`status-timeline__line status-timeline__line--right status-timeline__line--${
                      isLast ? 'hidden' : rightActive ? 'active' : 'pending'
                    }`}
                  />
                </View>
                <Text className={`status-timeline__label status-timeline__label--${state}`}>
                  {step.label}
                </Text>
                <Text className='status-timeline__time'>
                  {step.time || (step.current ? '进行中' : '')}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export default memo(StatusTimelineInner);
