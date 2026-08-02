import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../src/common/constants/enums';
import {
  createDeliveryOrder,
  createOrderService,
  moveOrderThrough,
} from './helpers/order-service';

test('merchant can cancel after accepted with refund path', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  await moveOrderThrough(service, order.id, [OrderStatus.PAID, OrderStatus.ACCEPTED]);

  const cancelled = await service.cancelOrder(order.id, undefined, '缺货取消');
  assert.equal(cancelled.status, OrderStatus.CANCELLED);
  assert.equal(cancelled.cancelReason, '缺货取消');
});

test('customer still cannot cancel after accepted', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  await moveOrderThrough(service, order.id, [OrderStatus.PAID, OrderStatus.ACCEPTED]);

  await assert.rejects(
    () => service.cancelOrder(order.id, order.userId, '我想取消'),
    (error: unknown) =>
      error instanceof BadRequestException &&
      String((error as BadRequestException).message).includes('不允许取消'),
  );
});

test('delivery flow uses ready_for_delivery then rider grab', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  await moveOrderThrough(service, order.id, [
    OrderStatus.PAID,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
  ]);

  const ready = await service.updateStatus(order.id, {
    status: OrderStatus.READY_FOR_DELIVERY,
  });
  assert.equal(ready.status, OrderStatus.READY_FOR_DELIVERY);

  const pool = await service.findDeliveryPool(1, 20);
  assert.equal(pool.items.some((item) => item.id === order.id), true);

  const grabbed = await service.grabOrder(order.id, 'rider-flow-1');
  assert.equal(grabbed.status, OrderStatus.DELIVERING);
  assert.equal(grabbed.riderId, 'rider-flow-1');

  const released = await service.releaseOrder(order.id, 'rider-flow-1');
  assert.equal(released.status, OrderStatus.READY_FOR_DELIVERY);
  assert.equal(released.riderId, undefined);
});

test('accept with estimatedMinutes sets estimatedCompletion', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  await service.updateStatus(order.id, { status: OrderStatus.PAID });
  const accepted = await service.updateStatus(order.id, {
    status: OrderStatus.ACCEPTED,
    estimatedMinutes: 20,
  });
  assert.ok(accepted.estimatedCompletion);
  const eta = new Date(accepted.estimatedCompletion!).getTime();
  assert.ok(eta > Date.now() + 15 * 60_000);
  assert.ok(eta < Date.now() + 25 * 60_000);
});

test('customer urge and cancel-request flow', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  await moveOrderThrough(service, order.id, [OrderStatus.PAID, OrderStatus.ACCEPTED]);

  const urged = await service.urgeOrder(order.id, order.userId);
  assert.equal(urged.urgeCount, 1);
  assert.ok(urged.lastUrgedAt);

  await assert.rejects(() => service.urgeOrder(order.id, order.userId));

  const requested = await service.requestCancel(order.id, order.userId, '临时有事');
  assert.ok(requested.cancelRequestedAt);
  assert.equal(requested.cancelRequestReason, '临时有事');

  const resolved = await service.resolveCancelRequest(order.id, true);
  assert.equal(resolved.status, OrderStatus.CANCELLED);
});

test('preparing cannot jump to delivering anymore', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  await moveOrderThrough(service, order.id, [
    OrderStatus.PAID,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
  ]);
  await assert.rejects(
    () => service.updateStatus(order.id, { status: OrderStatus.DELIVERING }),
    (error: unknown) => error instanceof BadRequestException,
  );
});
