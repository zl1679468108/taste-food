import React from 'react';
import { Tag } from 'antd';

const statusConfig: Record<string, { color: string; text: string }> = {
  pending_payment: { color: 'orange', text: '待支付' },
  paid: { color: 'blue', text: '已支付' },
  accepted: { color: 'purple', text: '已接单' },
  preparing: { color: 'cyan', text: '制作中' },
  delivering: { color: 'geekblue', text: '配送中' },
  completed: { color: 'green', text: '已完成' },
  cancelled: { color: 'default', text: '已取消' },
  rejected: { color: 'red', text: '已拒绝' },
  ready_for_pickup: { color: 'magenta', text: '待自取' },
};

interface OrderStatusTagProps {
  status: string;
}

const OrderStatusTag: React.FC<OrderStatusTagProps> = ({ status }) => {
  const config = statusConfig[status] || { color: 'default', text: status };
  return <Tag color={config.color}>{config.text}</Tag>;
};

export default OrderStatusTag;