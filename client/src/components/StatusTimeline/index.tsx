import { memo, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import { ORDER_STATUS_MAP } from '../../utils/constants';
import './index.scss';

interface StatusTimelineProps {
  currentStatus: string;
  statusHistory: Array<{ status: string; time: string }>;
}

function StatusTimelineInner({ currentStatus, statusHistory }: StatusTimelineProps) {
  const steps = useMemo(() => {
    // 已取消/已拒单的订单：只显示已发生的状态 + 终态，避免显示完整 8 步流程的 "--:--"
    const isTerminalAbnormal = currentStatus === 'cancelled' || currentStatus === 'rejected';
    const normalFlow = ['pending_payment', 'paid', 'accepted', 'preparing', 'delivering', 'completed'];
    const allStatuses = isTerminalAbnormal
      ? [...normalFlow.filter(s => statusHistory.some(h => h.status === s)), currentStatus]
      : ['pending_payment', 'paid', 'accepted', 'preparing', 'delivering', 'completed', 'cancelled', 'rejected'];

    const historyMap: Record<string, string> = {};
    for (const h of statusHistory) {
      historyMap[h.status] = h.time;
    }

    const result: Array<{ status: string; label: string; time: string; done: boolean; current: boolean }> = [];
    let reachedCurrent = false;

    for (const s of allStatuses) {
      const isCurrent = s === currentStatus;
      const isDone = reachedCurrent ? false : (historyMap[s] !== undefined && !isCurrent);
      if (isCurrent) reachedCurrent = true;

      result.push({
        status: s,
        label: ORDER_STATUS_MAP[s] || s,
        time: historyMap[s] || (isCurrent ? '—' : '--:--'),
        done: isDone,
        current: isCurrent,
      });
    }

    return result;
  }, [currentStatus, statusHistory]);

  return (
    <View className="status-timeline">
      <Text className="status-timeline__title">订单进度</Text>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <View key={step.status} className="status-timeline__item">
            <View className="status-timeline__dot-col">
              <View
                className={`status-timeline__dot status-timeline__dot--${step.done ? 'done' : step.current ? 'current' : 'pending'}`}
              />
              {!isLast && (
                <View
                  className={`status-timeline__line status-timeline__line--${step.done ? 'done' : 'pending'}`}
                />
              )}
            </View>
            <View className="status-timeline__content">
              <Text
                className={`status-timeline__label status-timeline__label--${step.done ? 'done' : step.current ? 'current' : 'pending'}`}
              >
                {step.label}
                {step.current && <Text className="status-timeline__badge">当前</Text>}
              </Text>
              <Text className="status-timeline__time">{step.time}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default memo(StatusTimelineInner);
