import React from 'react';
import { Alert, Button, Descriptions, Image, Modal, Space, Spin, Typography } from 'antd';
import type { Order } from '@/services/order';
import DeliveryTypeTag from '@/components/DeliveryTypeTag';
import OrderStatusTag from '@/components/OrderStatusTag';
import OrderStatusProgress from '@/components/OrderStatusProgress';
import RiderLocationPanel from '@/components/RiderLocationPanel';
import { formatPrice, formatTime } from '@/utils/format';
import { brand } from '@/theme';
import { displayOrderNo } from '../utils';

const { Text } = Typography;

export interface OrderDetailModalProps {
  open: boolean;
  loading: boolean;
  order: Order | null;
  /** 售后「同意/拒绝」按钮的提交态 */
  cancelResolveSubmitting: boolean;
  onClose: () => void;
  onApproveCancelRequest: (orderId: string) => void;
  onRejectCancelRequest: (orderId: string) => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  open,
  loading,
  order,
  cancelResolveSubmitting,
  onClose,
  onApproveCancelRequest,
  onRejectCancelRequest,
}) => {
  const hasPendingCancelRequest = Boolean(order?.cancelRequestedAt);

  return (
    <Modal
      title="订单详情"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={780}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        {order && (
          <>
            {hasPendingCancelRequest ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 'var(--tf-space-4)' }}
                message="退款售后 · 顾客申请取消"
                description={
                  <div>
                    <div>
                      申请时间：{formatTime(order.cancelRequestedAt!)}
                      {order.cancelRequestReason ? ` · 原因：${order.cancelRequestReason}` : ''}
                    </div>
                    <div style={{ marginTop: 'var(--tf-space-1_5)', color: brand.textSecondary }}>
                      同意后订单关闭，已支付 {formatPrice(order.total)} 将原路退回顾客
                    </div>
                    <Space style={{ marginTop: 'var(--tf-space-2)' }}>
                      <Button
                        type="primary"
                        danger
                        size="small"
                        loading={cancelResolveSubmitting}
                        onClick={() => onApproveCancelRequest(order.id)}
                      >
                        同意并退款
                      </Button>
                      <Button
                        size="small"
                        disabled={cancelResolveSubmitting}
                        onClick={() => onRejectCancelRequest(order.id)}
                      >
                        拒绝申请
                      </Button>
                    </Space>
                  </div>
                }
              />
            ) : null}

            <Descriptions
              column={2}
              bordered
              size="middle"
              styles={{ label: { width: 110, whiteSpace: 'nowrap' }, content: { background: brand.bgCard } }}
            >
              <Descriptions.Item label="订单号">
                <Text
                  strong
                  copyable
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayOrderNo(order)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <OrderStatusTag status={order.status} deliveryType={order.deliveryType} />
              </Descriptions.Item>
              <Descriptions.Item label="配送方式">
                <DeliveryTypeTag type={order.deliveryType} />
              </Descriptions.Item>
              <Descriptions.Item label="金额">
                <Text
                  strong
                  style={{ color: brand.textPrice, fontSize: 16, whiteSpace: 'nowrap' }}
                >
                  {formatPrice(order.total)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" styles={{ content: { whiteSpace: 'nowrap' } }}>
                {formatTime(order.createdAt)}
              </Descriptions.Item>
              {order.estimatedCompletion ? (
                <Descriptions.Item label="预计完成" styles={{ content: { whiteSpace: 'nowrap' } }}>
                  {formatTime(order.estimatedCompletion)}
                </Descriptions.Item>
              ) : (
                <Descriptions.Item label="预计完成">—</Descriptions.Item>
              )}
              {(order.urgeCount ?? 0) > 0 || order.lastUrgedAt ? (
                <Descriptions.Item label="催单" span={2}>
                  <Text type="warning">
                    {order.urgeCount ? `${order.urgeCount} 次` : '已催单'}
                    {order.lastUrgedAt ? ` · 最近 ${formatTime(order.lastUrgedAt)}` : ''}
                  </Text>
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <OrderStatusProgress order={order} />

            {order.deliveryType === 'delivery' && order.status === 'delivering' ? (
              <RiderLocationPanel order={order} />
            ) : null}

            {order.deliveryType === 'delivery' && order.deliveryProof ? (
              <div style={{ marginTop: 'var(--tf-space-4)' }}>
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  送达凭证
                </Typography.Title>
                <Descriptions
                  column={2}
                  bordered
                  size="middle"
                  styles={{ label: { width: 110, whiteSpace: 'nowrap' }, content: { background: brand.bgCard } }}
                >
                  <Descriptions.Item label="送达时间">
                    {formatTime(order.deliveryProof.deliveredAt)}
                  </Descriptions.Item>
                  <Descriptions.Item label="送达说明">
                    {order.deliveryProof.forceReason
                      ? `强制完成：${order.deliveryProof.forceReason}`
                      : typeof order.deliveryProof.confirmDistanceM === 'number'
                        ? `距收货点 ${Math.round(order.deliveryProof.confirmDistanceM)} 米${
                            order.deliveryProof.confirmRadiusM
                              ? `（围栏 ${Math.round(order.deliveryProof.confirmRadiusM)} 米）`
                              : ''
                          }`
                        : order.deliveryProof.confirmSource || '已确认'}
                  </Descriptions.Item>
                  <Descriptions.Item label="现场照片" span={2}>
                    {order.deliveryProof.photos?.length ? (
                      <Image.PreviewGroup>
                        <Space wrap>
                          {order.deliveryProof.photos.map((photo, idx) => (
                            <Image
                              key={`${photo.url}-${idx}`}
                              src={photo.url}
                              width={88}
                              height={88}
                              style={{ objectFit: 'cover', borderRadius: 8 }}
                            />
                          ))}
                        </Space>
                      </Image.PreviewGroup>
                    ) : (
                      <Text type="secondary">暂无照片</Text>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            ) : null}

            <Descriptions
              column={2}
              bordered
              size="middle"
              styles={{ label: { width: 110, whiteSpace: 'nowrap' }, content: { background: brand.bgCard } }}
            >
              <Descriptions.Item label="商品" span={2}>
                {order.items?.length
                  ? order.items.map((item) => `${item.name} x${item.quantity}`).join('、')
                  : '-'}
              </Descriptions.Item>
              {order.address ? (
                <Descriptions.Item label="地址" span={2}>
                  {order.address}
                </Descriptions.Item>
              ) : null}
              {order.tableNo ? (
                <Descriptions.Item label="桌号">{order.tableNo}</Descriptions.Item>
              ) : null}
              {order.contactName ? (
                <Descriptions.Item label="联系人">{order.contactName}</Descriptions.Item>
              ) : null}
              {order.contactPhone ? (
                <Descriptions.Item label="联系电话" styles={{ content: { whiteSpace: 'nowrap' } }}>
                  {order.contactPhone}
                </Descriptions.Item>
              ) : null}
              {/* 单列字段奇数个时补空位，避免后续 span=2 被挤到右半边出现空白行 */}
              {[order.tableNo, order.contactName, order.contactPhone].filter(Boolean).length % 2 ===
              1 ? (
                <Descriptions.Item label=" ">{' '}</Descriptions.Item>
              ) : null}
              {order.remark ? (
                <Descriptions.Item label="备注" span={2}>
                  <Text type="warning">{order.remark}</Text>
                </Descriptions.Item>
              ) : null}
              {order.cancelReason ? (
                <Descriptions.Item label="取消原因" span={2}>
                  <Text type="danger">{order.cancelReason}</Text>
                </Descriptions.Item>
              ) : null}
              {order.rejectReason ? (
                <Descriptions.Item label="拒单原因" span={2}>
                  <Text type="danger">{order.rejectReason}</Text>
                </Descriptions.Item>
              ) : null}
              {order.cancelRequestedAt ? (
                <Descriptions.Item label="取消申请" span={2}>
                  <Text type="warning">
                    {formatTime(order.cancelRequestedAt)}
                    {order.cancelRequestReason ? ` · ${order.cancelRequestReason}` : ''}
                  </Text>
                </Descriptions.Item>
              ) : null}
              {order.invoiceNeeded ? (
                <Descriptions.Item label="发票" span={2}>
                  <Text>
                    需要开票
                    {order.invoiceTitle ? ` · 抬头：${order.invoiceTitle}` : ''}
                    {order.invoiceTaxNo ? ` · 税号：${order.invoiceTaxNo}` : ''}
                  </Text>
                </Descriptions.Item>
              ) : null}
            </Descriptions>
          </>
        )}
      </Spin>
    </Modal>
  );
};

export default OrderDetailModal;
