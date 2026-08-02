import React from 'react';
import { Tag } from 'antd';
import { getOrderStatusLabel } from '../../utils/constants';

const statusColor: Record<string, string> = {
  pending_payment: 'orange',
  paid: 'blue',
  accepted: 'purple',
  preparing: 'cyan',
  ready_for_delivery: 'geekblue',
  delivering: 'blue',
  completed: 'green',
  cancelled: 'default',
  rejected: 'red',
  ready_for_pickup: 'magenta',
};

interface OrderStatusTagProps {
  status: string;
  deliveryType?: string;
}

const OrderStatusTag: React.FC<OrderStatusTagProps> = ({ status, deliveryType }) => {
  const color = statusColor[status] || 'default';
  const text = getOrderStatusLabel(status, deliveryType);
  return <Tag color={color}>{text}</Tag>;
};

export default OrderStatusTag;
