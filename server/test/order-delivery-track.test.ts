import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../src/common/constants/enums';
import { createDeliveryOrder, createOrderService, createPickupOrder } from './helpers/order-service';

test('appendDeliveryTrackPoint stores a point and emits a delivery track event', async () => {
  const { service, deliveryTrackEvents } = createOrderService();
  const order = await createDeliveryOrder(service);
  order.status = OrderStatus.DELIVERING;
  order.riderId = 'rider-1';

  const point = await service.appendDeliveryTrackPoint(order.id, 'rider-1', {
    latitude: 30.27662,
    longitude: 120.16021,
    speed: 8.5,
    accuracy: 12,
    source: 'rider_location',
  });
  const track = await service.listDeliveryTrack(order.id);

  assert.equal(track.length, 1);
  assert.equal(track[0].id, point.id);
  assert.equal(track[0].orderId, order.id);
  assert.equal(track[0].riderId, 'rider-1');
  assert.equal(track[0].latitude, 30.27662);
  assert.equal(track[0].longitude, 120.16021);
  assert.equal(track[0].source, 'rider_location');
  assert.equal(deliveryTrackEvents.length, 1);
  assert.deepEqual(deliveryTrackEvents[0], {
    orderId: order.id,
    shopId: order.shopId,
    userId: order.userId,
    riderId: 'rider-1',
    latitude: 30.27662,
    longitude: 120.16021,
    recordedAt: point.recordedAt,
  });
});

test('appendDeliveryTrackPoint rejects non-delivery orders', async () => {
  const { service } = createOrderService();
  const order = await createPickupOrder(service);
  order.status = OrderStatus.DELIVERING;

  await assert.rejects(
    () => service.appendDeliveryTrackPoint(order.id, 'rider-1', {
      latitude: 30,
      longitude: 120,
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '非外送订单无需配送轨迹',
  );
});

test('appendDeliveryTrackPoint rejects orders that are not delivering', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);

  await assert.rejects(
    () => service.appendDeliveryTrackPoint(order.id, 'rider-1', {
      latitude: 30,
      longitude: 120,
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '订单不在配送中，暂不能上报位置',
  );
});

test('appendDeliveryTrackPoint rejects reports from a different rider', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);
  order.status = OrderStatus.DELIVERING;
  order.riderId = 'rider-owner';

  await assert.rejects(
    () => service.appendDeliveryTrackPoint(order.id, 'rider-other', {
      latitude: 30,
      longitude: 120,
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '非本人配送订单，无权上报位置',
  );
});
