import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DeliveryType, OrderStatus } from '../src/common/constants/enums';
import {
  createOrderService,
  moveOrderThrough,
} from './helpers/order-service';

/**
 * §3.23 / T246.7 商家到店核销（self pick / dine in → ready_for_pickup → completed）
 *
 * 覆盖：
 *   - 自取 ready_for_pickup → completed
 *   - 堂食 ready_for_pickup → completed
 *   - 外卖拒收
 *   - 非 ready_for_pickup 状态拒收
 *   - 已完成二次核销 → 409
 *   - 跨店商家 → 403
 *   - operator.shopId 为空（无绑定店铺的商家）放行
 *
 * 注：merchantVerifyPickup 是 service 层方法，强制校验在 controller 也有一份（assertCanAccessOrder）。
 */

const SHOP_A = 'shop-A';
const SHOP_B = 'shop-B';
const MERCHANT_A = { userId: 'merchant-a', shopId: SHOP_A, role: 'merchant' };
const MERCHANT_B = { userId: 'merchant-b', shopId: SHOP_B, role: 'merchant' };
const MERCHANT_NO_SHOP = { userId: 'merchant-noop', shopId: undefined, role: 'merchant' };

async function createPickup(service: any, shopId = SHOP_A, userId = 'customer-1') {
  return service.create({
    shopId,
    userId,
    deliveryType: DeliveryType.PICKUP,
    items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
  } as never);
}

async function createDineIn(service: any, shopId = SHOP_A, userId = 'customer-1') {
  return service.create({
    shopId,
    userId,
    deliveryType: DeliveryType.DINE_IN,
    tableNo: 'A01',
    items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
  } as never);
}

async function createDelivery(service: any, shopId = SHOP_A, userId = 'customer-1') {
  return service.create({
    shopId,
    userId,
    deliveryType: DeliveryType.DELIVERY,
    address: '杭州市西湖区测试 1 号',
    deliveryLatitude: 30.2741,
    deliveryLongitude: 120.1551,
    contactName: '测试用户',
    contactPhone: '13800138000',
    items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
  } as never);
}

async function moveToReadyForPickup(service: any, orderId: string) {
  await moveOrderThrough(service, orderId, [
    OrderStatus.PAID,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
  ]);
}

test('商家核销自取订单：ready_for_pickup → completed', async () => {
  const { service, orderUpdatedEvents } = createOrderService();
  const order = await createPickup(service, SHOP_A);
  await moveToReadyForPickup(service, order.id);

  const verified = await service.merchantVerifyPickup(order.id, MERCHANT_A);
  assert.equal(verified.status, OrderStatus.COMPLETED);
  assert.ok(
    orderUpdatedEvents.some(
      (e) =>
        e.order.id === order.id &&
        e.order.status === OrderStatus.COMPLETED &&
        e.previousStatus === OrderStatus.READY_FOR_PICKUP,
    ),
    '订单状态机事件应当推送 (READY_FOR_PICKUP → COMPLETED)',
  );
});

test('商家核销堂食订单：ready_for_pickup → completed', async () => {
  const { service } = createOrderService();
  const order = await createDineIn(service, SHOP_A);
  await moveToReadyForPickup(service, order.id);

  const verified = await service.merchantVerifyPickup(order.id, MERCHANT_A);
  assert.equal(verified.status, OrderStatus.COMPLETED);
});

test('外卖订单拒收：商户不可核销外送单', async () => {
  const { service } = createOrderService();
  const order = await createDelivery(service, SHOP_A);
  await moveOrderThrough(service, order.id, [
    OrderStatus.PAID,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_DELIVERY,
  ]);

  await assert.rejects(
    () => service.merchantVerifyPickup(order.id, MERCHANT_A),
    (error: unknown) =>
      error instanceof BadRequestException &&
      String((error as BadRequestException).message).includes('外卖订单'),
  );
});

test('状态非 READY_FOR_PICKUP 拒收（避免出餐前误核销）', async () => {
  const { service } = createOrderService();
  const order = await createPickup(service, SHOP_A);
  await service.updateStatus(order.id, { status: OrderStatus.PAID });

  await assert.rejects(
    () => service.merchantVerifyPickup(order.id, MERCHANT_A),
    (error: unknown) =>
      error instanceof BadRequestException &&
      String((error as BadRequestException).message).includes('待取餐'),
  );
});

test('已完成订单二次核销 → 409 业务幂等', async () => {
  const { service } = createOrderService();
  const order = await createPickup(service, SHOP_A);
  await moveToReadyForPickup(service, order.id);

  await service.merchantVerifyPickup(order.id, MERCHANT_A);

  await assert.rejects(
    () => service.merchantVerifyPickup(order.id, MERCHANT_A),
    (error: unknown) => error instanceof ConflictException,
  );
});

test('跨店商家核销 → 403', async () => {
  const { service } = createOrderService();
  const order = await createPickup(service, SHOP_A);
  await moveToReadyForPickup(service, order.id);

  await assert.rejects(
    () => service.merchantVerifyPickup(order.id, MERCHANT_B),
    (error: unknown) =>
      error instanceof ForbiddenException &&
      String((error as ForbiddenException).message).includes('本店铺'),
  );
});

test('未绑定店铺的商家（operator.shopId 为空）放行', async () => {
  const { service } = createOrderService();
  const order = await createPickup(service, SHOP_A);
  await moveToReadyForPickup(service, order.id);

  // service 在 operator.shopId 为空时不强校验店铺归属（与 controller assertCanAccessOrder 互为冗余）
  const verified = await service.merchantVerifyPickup(order.id, MERCHANT_NO_SHOP);
  assert.equal(verified.status, OrderStatus.COMPLETED);
});
