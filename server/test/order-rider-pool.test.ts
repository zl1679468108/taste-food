import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus } from '../src/common/constants/enums';
import {
  createDeliveryOrder,
  createOrderService,
  moveOrderThrough,
} from './helpers/order-service';

test('rider pool includes unclaimed delivering delivery orders and allows claiming them', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  await moveOrderThrough(service, order.id, [
    OrderStatus.PAID,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.DELIVERING,
  ]);

  const pool = await service.findDeliveryPool(1, 20);
  assert.equal(pool.items.some((item) => item.id === order.id), true);

  const grabbed = await service.grabOrder(order.id, 'rider-1');
  assert.equal(grabbed.status, OrderStatus.DELIVERING);
  assert.equal(grabbed.riderId, 'rider-1');

  const mine = await service.findByRiderId('rider-1', undefined, 1, 20);
  assert.deepEqual(mine.items.map((item) => item.id), [order.id]);
});
