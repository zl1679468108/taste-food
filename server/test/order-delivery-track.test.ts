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
    riderDeliveryCount: 1,
    latitude: 30.27662,
    longitude: 120.16021,
    recordedAt: point.recordedAt,
  });
});

test('order detail and delivery track event include rider active delivery count', async () => {
  const { service, deliveryTrackEvents } = createOrderService();
  const first = await createDeliveryOrder(service);
  const second = await createDeliveryOrder(service);
  const third = await createDeliveryOrder(service);

  first.status = OrderStatus.DELIVERING;
  first.riderId = 'rider-load';
  second.status = OrderStatus.DELIVERING;
  second.riderId = 'rider-load';
  third.status = OrderStatus.COMPLETED;
  third.riderId = 'rider-load';

  const detail = await service.findById(first.id);
  assert.equal(detail.riderDeliveryCount, 2);

  await service.appendDeliveryTrackPoint(first.id, 'rider-load', {
    latitude: 30.27662,
    longitude: 120.16021,
  });

  assert.equal(deliveryTrackEvents[0].riderDeliveryCount, 2);
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

test('reportRiderLocation fans one location out to every delivering order of the rider', async () => {
  const { service, deliveryTrackEvents } = createOrderService();
  const first = await createDeliveryOrder(service);
  const second = await createDeliveryOrder(service);
  const riderId = `rider-auto-${Date.now()}`;

  first.status = OrderStatus.DELIVERING;
  first.riderId = riderId;
  second.status = OrderStatus.DELIVERING;
  second.riderId = riderId;

  const result = await service.reportRiderLocation(riderId, {
    latitude: 30.27662,
    longitude: 120.16021,
    speed: 6,
    accuracy: 15,
  });

  assert.equal(result.reported, 2);
  assert.equal(result.riderDeliveryCount, 2);
  assert.deepEqual([...result.orderIds].sort(), [first.id, second.id].sort());

  const firstTrack = await service.listDeliveryTrack(first.id);
  const secondTrack = await service.listDeliveryTrack(second.id);
  assert.equal(firstTrack.length, 1);
  assert.equal(secondTrack.length, 1);
  // 未显式传 source 时标记为自动上报，便于与手动上报区分
  assert.equal(firstTrack[0].source, 'rider_auto');
  assert.equal(firstTrack[0].speed, 6);
  assert.equal(firstTrack[0].accuracy, 15);
  // 同一次上报共享 recordedAt，多单轨迹时间戳一致
  assert.equal(firstTrack[0].recordedAt, result.recordedAt);
  assert.equal(secondTrack[0].recordedAt, result.recordedAt);

  assert.equal(deliveryTrackEvents.length, 2);
  for (const event of deliveryTrackEvents) {
    assert.equal(event.riderId, riderId);
    assert.equal(event.riderDeliveryCount, 2);
    assert.equal(event.recordedAt, result.recordedAt);
  }
  // 顾客私有房间靠 userId 定位，必须逐单带上各自的下单人
  assert.deepEqual(
    deliveryTrackEvents.map((event) => event.userId).sort(),
    [first.userId, second.userId].sort(),
  );
});

test('reportRiderLocation skips orders that are not delivering or not assigned to the rider', async () => {
  const { service, deliveryTrackEvents } = createOrderService();
  const delivering = await createDeliveryOrder(service);
  const preparing = await createDeliveryOrder(service);
  const otherRider = await createDeliveryOrder(service);
  const pickup = await createPickupOrder(service);
  const riderId = `rider-scope-${Date.now()}`;

  delivering.status = OrderStatus.DELIVERING;
  delivering.riderId = riderId;
  preparing.status = OrderStatus.PREPARING;
  preparing.riderId = riderId;
  otherRider.status = OrderStatus.DELIVERING;
  otherRider.riderId = `${riderId}-other`;
  pickup.status = OrderStatus.DELIVERING;
  pickup.riderId = riderId;

  const result = await service.reportRiderLocation(riderId, {
    latitude: 30.1,
    longitude: 120.1,
  });

  assert.deepEqual(result.orderIds, [delivering.id]);
  assert.equal(result.reported, 1);
  assert.equal(result.riderDeliveryCount, 1);
  assert.equal(deliveryTrackEvents.length, 1);
  assert.equal((await service.listDeliveryTrack(preparing.id)).length, 0);
  assert.equal((await service.listDeliveryTrack(otherRider.id)).length, 0);
});

test('reportRiderLocation is a no-op when the rider has no delivering order', async () => {
  const { service, deliveryTrackEvents } = createOrderService();

  const result = await service.reportRiderLocation(`rider-idle-${Date.now()}`, {
    latitude: 30,
    longitude: 120,
  });

  assert.equal(result.reported, 0);
  assert.deepEqual(result.orderIds, []);
  assert.equal(result.riderDeliveryCount, 0);
  assert.ok(result.recordedAt);
  assert.equal(deliveryTrackEvents.length, 0);
});

test('reportRiderLocation rejects an empty rider id', async () => {
  const { service } = createOrderService();

  await assert.rejects(
    () => service.reportRiderLocation('', { latitude: 30, longitude: 120 }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '缺少骑手身份，无法上报位置',
  );
});
