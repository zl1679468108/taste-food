import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../src/common/constants/enums';
import {
  createDeliveryOrder,
  createOrderService,
  moveOrderThrough,
} from './helpers/order-service';

test('customer can cancel own pending_payment order', async () => {
  const { service, orderUpdatedEvents } = createOrderService();
  const order = await createDeliveryOrder(service);

const cancelled = await service.cancelOrder(order.id, order.userId, '测试取消原因');

assert.equal(cancelled.status, OrderStatus.CANCELLED);
assert.equal(orderUpdatedEvents.length, 1);
assert.equal(orderUpdatedEvents[0].previousStatus, OrderStatus.PENDING_PAYMENT);
assert.equal(orderUpdatedEvents[0].order.status, OrderStatus.CANCELLED);
});

test('customer can cancel own paid order before merchant accepts', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  await service.updateStatus(order.id, { status: OrderStatus.PAID });

const cancelled = await service.cancelOrder(order.id, order.userId, '测试取消原因');
assert.equal(cancelled.status, OrderStatus.CANCELLED);
});

test('customer cannot cancel another user order', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);

  await assert.rejects(
    () => service.cancelOrder(order.id, 'other-user'),
    (error: unknown) =>
      error instanceof BadRequestException && error.message === '不能取消他人的订单',
  );
});

test('merchant/admin can cancel paid order without customer userId', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  await service.updateStatus(order.id, { status: OrderStatus.PAID });

const cancelled = await service.cancelOrder(order.id, undefined, '测试取消原因');
assert.equal(cancelled.status, OrderStatus.CANCELLED);
});

test('cannot cancel after merchant accepted (needs merchant handling)', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  await moveOrderThrough(service, order.id, [
    OrderStatus.PAID,
    OrderStatus.ACCEPTED,
  ]);

await assert.rejects(
  () => service.cancelOrder(order.id, order.userId, '测试取消原因'),
  (error: unknown) =>
    error instanceof BadRequestException &&
    String((error as BadRequestException).message).includes('不允许取消'),
);
});
