import { memo, type ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import { formatPriceWithSymbol, formatRelativeTime } from '../../utils/format';
import { ORDER_STATUS_COLOR_MAP, getOrderStatusLabel } from '../../utils/constants';
import type { Order } from '../../types/order';
import './index.scss';

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
  const statusColor = ORDER_STATUS_COLOR_MAP[order.status] || '#999';
  const statusText = getOrderStatusLabel(order.status, order.deliveryType);
  const items = order.items || [];

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

      <View className='tf-order-card__footer'>
        <Text className='tf-order-card__time'>{formatRelativeTime(order.createdAt)}</Text>
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
