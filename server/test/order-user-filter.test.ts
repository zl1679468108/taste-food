import test from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryType, OrderStatus } from '../src/common/constants/enums';
import { createOrderService } from './helpers/order-service';
import { PaymentService } from '../src/modules/payment/payment.service';

function withSandboxPaymentEnv() {
  const previousProvider = process.env.PAYMENT_PROVIDER;
  const previousAllowSandbox = process.env.ALLOW_SANDBOX_PAYMENT;
  process.env.PAYMENT_PROVIDER = 'sandbox';
  process.env.ALLOW_SANDBOX_PAYMENT = 'true';
  return () => {
    if (previousProvider === undefined) {
      delete process.env.PAYMENT_PROVIDER;
    } else {
      process.env.PAYMENT_PROVIDER = previousProvider;
    }
    if (previousAllowSandbox === undefined) {
      delete process.env.ALLOW_SANDBOX_PAYMENT;
    } else {
      process.env.ALLOW_SANDBOX_PAYMENT = previousAllowSandbox;
    }
  };
}

test('findByUserId filters customer orders by status', async () => {
  const restoreEnv = withSandboxPaymentEnv();
  try {
    const { service } = createOrderService();
    const paymentService = new PaymentService(service);
    const userId = `user-filter-${Date.now()}`;
    const shopId = `shop-filter-${Date.now()}`;

    const pending = await service.create({
      shopId,
      userId,
      deliveryType: DeliveryType.DELIVERY,
      address: '杭州市西湖区测试地址 1 号',
      deliveryLatitude: 30.2741,
      deliveryLongitude: 120.1551,
      contactName: '测试',
      contactPhone: '13800138000',
      items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
    } as any);
    const paid = await service.create({
      shopId,
      userId,
      deliveryType: DeliveryType.DELIVERY,
      address: '杭州市西湖区测试地址 2 号',
      deliveryLatitude: 30.2742,
      deliveryLongitude: 120.1552,
      contactName: '测试',
      contactPhone: '13800138001',
      items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
    } as any);
    await paymentService.payOrder(paid.id, userId);

    const all = await service.findByUserId(userId, 1, 20);
    const pendingOnly = await service.findByUserId(
      userId,
      1,
      20,
      OrderStatus.PENDING_PAYMENT,
    );
    const paidOnly = await service.findByUserId(userId, 1, 20, OrderStatus.PAID);

    assert.equal(all.items.length, 2);
    assert.equal(pendingOnly.items.length, 1);
    assert.equal(pendingOnly.items[0].id, pending.id);
    assert.equal(pendingOnly.items[0].status, OrderStatus.PENDING_PAYMENT);
    assert.equal(paidOnly.items.length, 1);
    assert.equal(paidOnly.items[0].id, paid.id);
    assert.equal(paidOnly.items[0].status, OrderStatus.PAID);
  } finally {
    restoreEnv();
  }
});
