import React from 'react';
import { Badge, Tabs } from 'antd';
import { brand } from '@/theme';
import type { OrderStatusBadges } from '../hooks/useOrderStatusBadges';

export interface OrderStatusTabsProps {
  activeKey: string;
  onChange: (key: string) => void;
  /** 各状态 Tab 的角标数量（key 与 tab key 对应，如 paid / ready_for_delivery / refund） */
  badges?: OrderStatusBadges;
}

const OrderStatusTabs: React.FC<OrderStatusTabsProps> = ({
  activeKey,
  onChange,
  badges = {},
}) => {
  const renderLabel = (key: string, label: string) => {
    const count = badges[key];
    if (!count || count <= 0) return label;
    return (
      <span>
        {label}
        <Badge
          count={count}
          color={brand.primary}
          style={{ marginLeft: 'var(--tf-space-2)', fontSize: 11 }}
        />
      </span>
    );
  };

  const items = [
    { key: '', label: renderLabel('', '全部') },
    { key: 'pending_payment', label: renderLabel('pending_payment', '待支付') },
    {
      key: 'paid',
      label: renderLabel('paid', '已支付'),
    },
    { key: 'accepted', label: renderLabel('accepted', '已接单') },
    { key: 'preparing', label: renderLabel('preparing', '制作中') },
    { key: 'ready_for_delivery', label: renderLabel('ready_for_delivery', '待配送') },
    { key: 'ready_for_pickup', label: renderLabel('ready_for_pickup', '待取餐') },
    { key: 'delivering', label: renderLabel('delivering', '配送中') },
    { key: 'refund', label: renderLabel('refund', '退款售后') },
    { key: 'completed', label: renderLabel('completed', '已完成') },
  ];

  return (
    <Tabs
      activeKey={activeKey}
      onChange={onChange}
      items={items}
      style={{ marginBottom: 'var(--tf-space-2)' }}
    />
  );
};

export default OrderStatusTabs;
