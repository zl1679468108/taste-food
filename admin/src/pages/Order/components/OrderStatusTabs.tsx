import React from 'react';
import { Badge, Tabs } from 'antd';
import { brand } from '@/theme';
import type { OrderStatusCounts } from '@/services/order';

export interface OrderStatusTabsProps {
  activeKey: string;
  onChange: (key: string) => void;
  /**
   * 各状态 Tab 的角标数量，直接由 `GET /api/orders` 的 `data.counts` 透传。
   *   - key=''（全部）→ counts.all
   *   - 其他 → counts[<status>]（如 paid / accepted / ... / refund）
   * 未到位（首次加载）时传 `undefined`，自动隐藏所有角标。
   */
  counts?: OrderStatusCounts;
}

/** Tabs 中「全部」对应的虚拟 key；counts 里以 `all` 字段承载 */
const ALL_KEY = '';

const OrderStatusTabs: React.FC<OrderStatusTabsProps> = ({
  activeKey,
  onChange,
  counts,
}) => {
  const renderLabel = (key: string, label: string) => {
    const value = counts ? counts[key as keyof OrderStatusCounts] ?? 0 : 0;
    if (!value || value <= 0) return label;
    return (
      <span>
        {label}
        <Badge
          count={value}
          color={brand.primary}
          style={{ marginLeft: 'var(--tf-space-2)', fontSize: 11 }}
        />
      </span>
    );
  };

  const items = [
    { key: ALL_KEY, label: renderLabel('all', '全部') },
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
