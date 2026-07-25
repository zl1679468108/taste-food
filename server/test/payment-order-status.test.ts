import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, UserRole } from '../src/common/constants/enums';
import { PaymentService } from '../src/modules/payment/payment.service';
import {
  createDeliveryOrder,
  createOrderService,
  createPickupOrder,
  moveOrderThrough,
} from './helpers/order-service';

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

test('sandbox payment marks a pending order as paid and emits paid/new-order events', async () => {
  const restoreEnv = withSandboxPaymentEnv();
  try {
    const { service: orderService, orderUpdatedEvents, orderNewEvents } = createOrderService();
    const paymentService = new PaymentService(orderService);
    const order = await createDeliveryOrder(orderService);

    const payment = await paymentService.payOrder(order.id, order.userId);
    const paidOrder = await orderService.findById(order.id);
    const savedPayment = await paymentService.getPaymentByOrderId(order.id, {
      userId: order.userId,
      openid: 'openid-user',
      role: UserRole.CUSTOMER,
    });

    assert.equal(payment.orderId, order.id);
    assert.equal(payment.amount, 1200);
    assert.equal(payment.status, 'success');
    assert.equal(payment.mock, true);
    assert.equal(payment.provider, 'sandbox');
    assert.equal(paidOrder.status, OrderStatus.PAID);
    assert.deepEqual(savedPayment, payment);
    assert.equal(orderUpdatedEvents.length, 1);
    assert.equal(orderUpdatedEvents[0].previousStatus, OrderStatus.PENDING_PAYMENT);
    assert.equal(orderUpdatedEvents[0].order.status, OrderStatus.PAID);
    assert.equal(orderNewEvents.length, 1);
    assert.equal(orderNewEvents[0].order.id, order.id);
  } finally {
    restoreEnv();
  }
});

test('sandbox payment rejects paying another customer order', async () => {
  const restoreEnv = withSandboxPaymentEnv();
  try {
    const { service: orderService } = createOrderService();
    const paymentService = new PaymentService(orderService);
    const order = await createDeliveryOrder(orderService);

    await assert.rejects(
      () => paymentService.payOrder(order.id, 'other-user'),
      (error: unknown) =>
        error instanceof BadRequestException &&
        error.message === '不能支付他人的订单',
    );
  } finally {
    restoreEnv();
  }
});

test('sandbox payment rejects paying an order twice', async () => {
  const restoreEnv = withSandboxPaymentEnv();
  try {
    const { service: orderService } = createOrderService();
    const paymentService = new PaymentService(orderService);
    const order = await createDeliveryOrder(orderService);

    await paymentService.payOrder(order.id, order.userId);
    await assert.rejects(
      () => paymentService.payOrder(order.id, order.userId),
      (error: unknown) =>
        error instanceof BadRequestException &&
        error.message === `订单状态为 ${OrderStatus.PAID}，不允许支付`,
    );
  } finally {
    restoreEnv();
  }
});

test('getPaymentByOrderId enforces customer ownership', async () => {
  const restoreEnv = withSandboxPaymentEnv();
  try {
    const { service: orderService } = createOrderService();
    const paymentService = new PaymentService(orderService);
    const order = await createDeliveryOrder(orderService);
    await paymentService.payOrder(order.id, order.userId);

    await assert.rejects(
      () => paymentService.getPaymentByOrderId(order.id, {
        userId: 'other-user',
        openid: 'openid-other',
        role: UserRole.CUSTOMER,
      }),
      (error: unknown) =>
        error instanceof ForbiddenException &&
        error.message === '无权查看该订单支付信息',
    );
  } finally {
    restoreEnv();
  }
});

test('delivery order follows paid to completed status path', async () => {
  const { service } = createOrderService();
  const order = await createDeliveryOrder(service);

  const completed = await moveOrderThrough(service, order.id, [
    OrderStatus.PAID,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.DELIVERING,
    OrderStatus.COMPLETED,
  ]);

  assert.equal(completed.status, OrderStatus.COMPLETED);
});

test('pickup order follows ready-for-pickup path before completed', async () => {
  const { service } = createOrderService();
  const order = await createPickupOrder(service);

  const completed = await moveOrderThrough(service, order.id, [
    OrderStatus.PAID,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.COMPLETED,
  ]);

  assert.equal(completed.status, OrderStatus.COMPLETED);
});

test('preparing orders cannot skip directly to completed', async () => {
  const { service } = createOrderService();
  const order = await createPickupOrder(service);
  await moveOrderThrough(service, order.id, [
    OrderStatus.PAID,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
  ]);

  await assert.rejects(
    () => service.updateStatus(order.id, { status: OrderStatus.COMPLETED }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === `订单状态不能从 ${OrderStatus.PREPARING} 变更为 ${OrderStatus.COMPLETED}`,
  );
});
