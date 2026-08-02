import { memo, type ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import { formatPriceWithSymbol, formatTime } from '../../utils/format';
import {
  ORDER_STATUS_COLOR_MAP,
  OrderStatus,
  getOrderStatusLabel,
  isTerminalStatus,
} from '../../utils/constants';
import type { Order } from '../../types/order';
import './index.scss';

/** 列表卡片售后态：取消申请中优先展示，其余走标准状态文案 */
function resolveOrderCardStatus(order: Order): { text: string; color: string } {
  const baseColor = ORDER_STATUS_COLOR_MAP[order.status] || '#999';
  if (order.cancelRequestedAt && !isTerminalStatus(order.status)) {
    return { text: '售后处理中', color: ORDER_STATUS_COLOR_MAP[OrderStatus.PENDING_PAYMENT] };
  }
  if (order.status === OrderStatus.CANCELLED) {
    return { text: '已取消', color: baseColor };
  }
  if (order.status === OrderStatus.REJECTED) {
    return { text: '已拒单', color: baseColor };
  }
  return {
    text: getOrderStatusLabel(order.status, order.deliveryType),
    color: baseColor,
  };
}

interface OrderCardProps {
  order: Order;
  shopName?: string;
  onClick?: () => void;
  /** 自定义底部操作区 */
  footerExtra?: ReactNode;
  className?: string;
}

function OrderCardInner({
  order,
  shopName = '店铺',
  onClick,
  footerExtra,
  className = '',
}: OrderCardProps) {
  const { text: statusText, color: statusColor } = resolveOrderCardStatus(order);
  const items = order.items || [];
  const afterSaleTip = order.cancelRequestedAt && !isTerminalStatus(order.status)
    ? `取消申请：${order.cancelRequestReason || '等待商家处理'}`
    : order.status === OrderStatus.CANCELLED && order.cancelReason
      ? `取消原因：${order.cancelReason}`
      : order.status === OrderStatus.REJECTED && order.rejectReason
        ? `拒单原因：${order.rejectReason}`
        : '';

  return (
    <View className={`tf-order-card ${className}`.trim()} onClick={onClick}>
      <View className='tf-order-card__header'>
        <Text className='tf-order-card__shop'>{shopName}</Text>
        <Text
          className='tf-order-card__status'
          style={{ color: statusColor, background: `${statusColor}15` }}
        >
          {statusText}
        </Text>
      </View>

      <View className='tf-order-card__goods'>
        {items.slice(0, 3).map((item) => (
          <Text key={item.id} className='tf-order-card__goods-item'>
            {item.name} x{item.quantity}
          </Text>
        ))}
        {items.length > 3 && (
          <Text className='tf-order-card__goods-item tf-order-card__goods-item--more'>
            等 {items.length} 件商品
          </Text>
        )}
      </View>

      {afterSaleTip ? (
        <Text className='tf-order-card__tip'>{afterSaleTip}</Text>
      ) : null}

      <View className='tf-order-card__footer'>
        <Text className='tf-order-card__time'>{formatTime(order.createdAt, 'YYYY-MM-DD HH:mm:ss')}</Text>
        <Text className='tf-order-card__total'>
          合计{' '}
          <Text className='tf-order-card__total-price'>{formatPriceWithSymbol(order.total)}</Text>
        </Text>
      </View>

      {footerExtra ? <View className='tf-order-card__actions'>{footerExtra}</View> : null}
    </View>
  );
}

export default memo(OrderCardInner);
