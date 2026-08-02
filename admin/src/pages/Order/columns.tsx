import React from 'react';
import { Button, Space, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { getOrderStatusActions } from '@taste-food/shared';
import type { Order } from '@/services/order';
import DeliveryTypeTag from '@/components/DeliveryTypeTag';
import OrderStatusTag from '@/components/OrderStatusTag';
import PriceDisplay from '@/components/PriceDisplay';
import { formatTime } from '@/utils/format';
import type { ReasonMode } from './hooks/useReasonModal';
import { displayOrderNo } from './utils';

const { Text } = Typography;

export interface BuildOrderColumnsOptions {
  /** 正在流转的 `${orderId}:${status}` 集合 */
  pendingKeys: Set<string>;
  /** 该订单行是否有流转在途 */
  isRowPending: (orderId: string) => boolean;
  onViewDetail: (order: Order) => void;
  onOpenReason: (orderId: string, mode: ReasonMode) => void;
  onOpenAccept: (orderId: string, targetStatus: string) => void;
  onRowStatusUpdate: (orderId: string, status: string) => void;
}

export function buildOrderColumns({
  pendingKeys,
  isRowPending,
  onViewDetail,
  onOpenReason,
  onOpenAccept,
  onRowStatusUpdate,
}: BuildOrderColumnsOptions) {
  return [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (_: string, record: Order) => (
        <Text strong style={{ fontFamily: 'monospace' }}>
          {displayOrderNo(record)}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string, record: Order) => (
        <OrderStatusTag status={status} deliveryType={record.deliveryType} />
      ),
    },
    {
      title: '配送方式',
      dataIndex: 'deliveryType',
      key: 'deliveryType',
      width: 110,
      render: (type: string) => <DeliveryTypeTag type={type} />,
    },
    {
      title: '金额',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      render: (total: number) => <PriceDisplay price={total} />,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (time: string) => formatTime(time),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right' as const,
      render: (_: Order, record: Order) => (
        <Space wrap size={[0, 4]}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => onViewDetail(record)}>
            详情
          </Button>
          {record.cancelRequestedAt ? (
            <Text type="danger" style={{ fontSize: 12 }}>
              售后待处理
            </Text>
          ) : null}
          {getOrderStatusActions(record.status, record.deliveryType).map((action) => {
            const actionKey = `${record.id}:${action.status}`;
            const isSelfPending = pendingKeys.has(actionKey);
            // 仅锁「同一行」的其他按钮，不影响其他订单行
            const isRowLocked = !isSelfPending && isRowPending(record.id);

            if (action.cancel || action.status === 'rejected') {
              return (
                <Button
                  key={`${action.status}-${action.label}`}
                  type="link"
                  danger
                  disabled={isRowLocked}
                  onClick={() => onOpenReason(record.id, action.cancel ? 'cancel' : 'reject')}
                >
                  {action.label}
                </Button>
              );
            }

            if (action.forceComplete) {
              return (
                <Button
                  key={`${action.status}-${action.label}`}
                  type="link"
                  loading={isSelfPending}
                  disabled={isRowLocked}
                  onClick={() => onOpenReason(record.id, 'force')}
                >
                  {action.label}
                </Button>
              );
            }

            if (action.acceptWithEta) {
              return (
                <Button
                  key={`${action.status}-${action.label}`}
                  type="link"
                  loading={isSelfPending}
                  disabled={isRowLocked}
                  onClick={() => onOpenAccept(record.id, action.status)}
                >
                  {action.label}
                </Button>
              );
            }

            return (
              <Button
                key={`${action.status}-${action.label}`}
                type="link"
                danger={action.type === 'danger'}
                loading={isSelfPending}
                disabled={isRowLocked}
                onClick={() => onRowStatusUpdate(record.id, action.status)}
              >
                {action.label}
              </Button>
            );
          })}
        </Space>
      ),
    },
  ];
}
