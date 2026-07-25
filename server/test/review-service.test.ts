import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DeliveryType, OrderStatus } from '../src/common/constants/enums';
import { OrderService } from '../src/modules/order/order.service';
import { ReviewService } from '../src/modules/review/review.service';
import { createOrderService, moveOrderThrough } from './helpers/order-service';

async function createCompletedOrder(
  service: OrderService,
  options: {
    shopId?: string;
    userId?: string;
    deliveryType?: DeliveryType;
  } = {},
) {
  const deliveryType = options.deliveryType || DeliveryType.PICKUP;
  const order = await service.create({
    shopId: options.shopId || `shop-${Date.now()}-${Math.random()}`,
    userId: options.userId || `user-${Date.now()}-${Math.random()}`,
    deliveryType,
    address: deliveryType === DeliveryType.DELIVERY ? '杭州市西湖区测试地址 1 号' : undefined,
    tableNo: deliveryType === DeliveryType.DINE_IN ? 'A01' : undefined,
    items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
  });

  if (deliveryType === DeliveryType.DELIVERY) {
    return moveOrderThrough(service, order.id, [
      OrderStatus.PAID,
      OrderStatus.ACCEPTED,
      OrderStatus.PREPARING,
      OrderStatus.DELIVERING,
      OrderStatus.COMPLETED,
    ]);
  }

  return moveOrderThrough(service, order.id, [
    OrderStatus.PAID,
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.COMPLETED,
  ]);
}

test('createForOrder stores a completed order review and trims content', async () => {
  const { service: orderService } = createOrderService();
  const reviewService = new ReviewService(orderService);
  const order = await createCompletedOrder(orderService, {
    shopId: 'shop-review-create',
    userId: 'user-review-create',
  });

  const review = await reviewService.createForOrder(order.id, order.userId, {
    rating: 5,
    content: '  味道很好，出餐也快  ',
  });
  const found = await reviewService.findByOrderId(order.id);

  assert.equal(review.orderId, order.id);
  assert.equal(review.shopId, 'shop-review-create');
  assert.equal(review.userId, 'user-review-create');
  assert.equal(review.rating, 5);
  assert.equal(review.content, '味道很好，出餐也快');
  assert.deepEqual(found, review);
});

test('createForOrder rejects non-completed orders and other users', async () => {
  const { service: orderService } = createOrderService();
  const reviewService = new ReviewService(orderService);
  const pendingOrder = await orderService.create({
    shopId: 'shop-review-reject',
    userId: 'user-review-owner',
    deliveryType: DeliveryType.PICKUP,
    items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
  });
  const completedOrder = await createCompletedOrder(orderService, {
    shopId: 'shop-review-reject',
    userId: 'user-review-owner',
  });

  await assert.rejects(
    () => reviewService.createForOrder(pendingOrder.id, pendingOrder.userId, {
      rating: 5,
      content: '还没完成就不能评价',
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '仅已完成订单可评价',
  );
  await assert.rejects(
    () => reviewService.createForOrder(completedOrder.id, 'user-review-other', {
      rating: 5,
      content: '不是本人的订单',
    }),
    (error: unknown) =>
      error instanceof ForbiddenException &&
      error.message === '只能评价自己的订单',
  );
});

test('createForOrder rejects duplicate reviews and invalid review payloads', async () => {
  const { service: orderService } = createOrderService();
  const reviewService = new ReviewService(orderService);
  const order = await createCompletedOrder(orderService, {
    shopId: 'shop-review-duplicate',
    userId: 'user-review-duplicate',
  });
  const invalidOrder = await createCompletedOrder(orderService, {
    shopId: 'shop-review-invalid',
    userId: 'user-review-invalid',
  });

  await reviewService.createForOrder(order.id, order.userId, {
    rating: 4,
    content: '第一次评价',
  });

  await assert.rejects(
    () => reviewService.createForOrder(order.id, order.userId, {
      rating: 3,
      content: '重复评价',
    }),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message === '该订单已评价，不可重复提交',
  );
  await assert.rejects(
    () => reviewService.createForOrder(invalidOrder.id, invalidOrder.userId, {
      rating: 6,
      content: '评分越界',
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '评分须为 1-5 的整数',
  );
  await assert.rejects(
    () => reviewService.createForOrder(invalidOrder.id, invalidOrder.userId, {
      rating: 5,
      content: 'x'.repeat(501),
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '评价内容不能超过 500 字',
  );
});

test('listByShop filters reviews by shop and paginates results', async () => {
  const { service: orderService } = createOrderService();
  const reviewService = new ReviewService(orderService);
  const orderA1 = await createCompletedOrder(orderService, {
    shopId: 'shop-review-list-a',
    userId: 'user-review-list-a1',
  });
  const orderA2 = await createCompletedOrder(orderService, {
    shopId: 'shop-review-list-a',
    userId: 'user-review-list-a2',
  });
  const orderB = await createCompletedOrder(orderService, {
    shopId: 'shop-review-list-b',
    userId: 'user-review-list-b',
  });

  await reviewService.createForOrder(orderA1.id, orderA1.userId, {
    rating: 5,
    content: 'A1',
  });
  await reviewService.createForOrder(orderA2.id, orderA2.userId, {
    rating: 4,
    content: 'A2',
  });
  await reviewService.createForOrder(orderB.id, orderB.userId, {
    rating: 3,
    content: 'B',
  });

  const page1 = await reviewService.listByShop('shop-review-list-a', 1, 1);
  const page2 = await reviewService.listByShop('shop-review-list-a', 2, 1);

  assert.equal(page1.total, 2);
  assert.equal(page1.page, 1);
  assert.equal(page1.pageSize, 1);
  assert.equal(page1.items.length, 1);
  assert.equal(page2.items.length, 1);
  assert.deepEqual(
    [...page1.items, ...page2.items].map((review) => review.shopId).sort(),
    ['shop-review-list-a', 'shop-review-list-a'],
  );
});

test('replyToReview trims and persists merchant replies', async () => {
  const { service: orderService } = createOrderService();
  const reviewService = new ReviewService(orderService);
  const order = await createCompletedOrder(orderService, {
    shopId: 'shop-review-reply',
    userId: 'user-review-reply',
  });
  const review = await reviewService.createForOrder(order.id, order.userId, {
    rating: 5,
    content: '好吃',
  });

  const replied = await reviewService.replyToReview(
    review.id,
    'shop-review-reply',
    '  谢谢喜欢，欢迎再来  ',
  );
  const found = await reviewService.findByOrderId(order.id);

  assert.equal(replied.replyContent, '谢谢喜欢，欢迎再来');
  assert.ok(replied.replyAt);
  assert.equal(found?.replyContent, '谢谢喜欢，欢迎再来');
});

test('replyToReview rejects empty, missing, and cross-shop replies', async () => {
  const { service: orderService } = createOrderService();
  const reviewService = new ReviewService(orderService);
  const order = await createCompletedOrder(orderService, {
    shopId: 'shop-review-reply-owner',
    userId: 'user-review-reply-owner',
  });
  const review = await reviewService.createForOrder(order.id, order.userId, {
    rating: 5,
    content: '需要回复的评价',
  });

  await assert.rejects(
    () => reviewService.replyToReview(review.id, 'shop-review-reply-owner', '   '),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '回复内容不能为空',
  );
  await assert.rejects(
    () => reviewService.replyToReview('missing-review-id', 'shop-review-reply-owner', '收到'),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '评价不存在',
  );
  await assert.rejects(
    () => reviewService.replyToReview(review.id, 'shop-review-other', '收到'),
    (error: unknown) =>
      error instanceof ForbiddenException &&
      error.message === '无权回复其他店铺评价',
  );
});
