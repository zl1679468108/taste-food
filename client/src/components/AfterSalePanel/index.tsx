import { memo } from 'react';
import { View, Text } from '@tarojs/components';
import type { AfterSaleStep } from '@taste-food/shared/constants';
import { formatPriceWithSymbol, formatTime } from '../../utils/format';
import './index.scss';

export interface AfterSalePanelProps {
  steps: AfterSaleStep[];
  /** 退款金额（分），有支付时展示 */
  refundAmount?: number;
  /** 支付状态文案补充 */
  paymentStatus?: string | null;
  /** 嵌入状态摘要卡：去掉独立卡片样式，仅作分区内容 */
  embedded?: boolean;
  className?: string;
}

function formatStepTime(time?: string) {
  if (!time) return '';
  const formatted = formatTime(time, 'MM-DD HH:mm');
  return formatted === 'Invalid Date' ? '' : formatted;
}

function paymentStatusLabel(status?: string | null) {
  if (!status) return '';
  if (status === 'refunded') return '已退款';
  // 兼容历史 success 与规范 paid
  if (status === 'paid' || status === 'success') return '已支付待退';
  if (status === 'pending') return '待支付';
  if (status === 'failed') return '支付失败';
  return status;
}

function AfterSalePanelInner({
  steps,
  refundAmount,
  paymentStatus,
  embedded = false,
  className = '',
}: AfterSalePanelProps) {
  if (!steps.length) return null;

  const showRefundMeta =
    typeof refundAmount === 'number' &&
    refundAmount > 0 &&
    (paymentStatus === 'paid' ||
      paymentStatus === 'success' ||
      paymentStatus === 'refunded');

  return (
    <View
      className={`tf-after-sale${embedded ? ' tf-after-sale--embedded' : ''} ${className}`.trim()}
    >
      <View className='tf-after-sale__header'>
        <Text className='tf-after-sale__title'>退款售后进度</Text>
        {showRefundMeta ? (
          <Text className='tf-after-sale__amount'>
            {paymentStatus === 'refunded' ? '退款' : '应退'}{' '}
            {formatPriceWithSymbol(refundAmount)}
          </Text>
        ) : null}
      </View>

      {paymentStatus ? (
        <View className='tf-after-sale__meta'>
          <Text className='tf-after-sale__meta-text'>
            支付状态：{paymentStatusLabel(paymentStatus)}
            {paymentStatus === 'refunded' ? ' · 预计 1-3 个工作日到账' : ''}
          </Text>
        </View>
      ) : null}

      <View className='tf-after-sale__steps'>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <View key={step.key} className={`tf-after-sale__step tf-after-sale__step--${step.state}`}>
              <View className='tf-after-sale__rail'>
                <View className='tf-after-sale__dot' />
                {!isLast ? <View className='tf-after-sale__line' /> : null}
              </View>
              <View className='tf-after-sale__body'>
                <View className='tf-after-sale__row'>
                  <Text className='tf-after-sale__step-title'>{step.title}</Text>
                  {step.time ? (
                    <Text className='tf-after-sale__step-time'>{formatStepTime(step.time)}</Text>
                  ) : null}
                </View>
                {step.desc ? (
                  <Text className='tf-after-sale__step-desc'>{step.desc}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default memo(AfterSalePanelInner);
