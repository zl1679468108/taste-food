import test from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { DeliveryType, PromotionStatus, PromotionType } from '../src/common/constants/enums';
import { DEFAULT_SHOP_ID } from '../src/common/constants/shop';
import { PromotionController } from '../src/modules/promotion/promotion.controller';
import { PromotionService } from '../src/modules/promotion/promotion.service';
import { createOrderService } from './helpers/order-service';

function uniqueShopId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

function isoOffset(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

test('findAllByShop returns only currently active promotions for a shop', async () => {
  const service = new PromotionService();
  const shopId = uniqueShopId('shop-promo-window');
  const otherShopId = uniqueShopId('shop-promo-window-other');
  const active = await service.create({
    shopId,
    type: PromotionType.FULL_DISCOUNT,
    name: '当前满减',
    description: '满 30 减 5',
    rule: { threshold: 3000, discount: 500 },
    startDate: isoOffset(-60_000),
    endDate: isoOffset(60_000),
    status: PromotionStatus.ACTIVE,
  });
  await service.create({
    shopId,
    type: PromotionType.FULL_DISCOUNT,
    name: '未来满减',
    rule: { threshold: 3000, discount: 1000 },
    startDate: isoOffset(60_000),
    endDate: isoOffset(120_000),
    status: PromotionStatus.ACTIVE,
  });
  await service.create({
    shopId,
    type: PromotionType.FIRST_ORDER,
    name: '已过期首单',
    rule: { discount: 800 },
    startDate: isoOffset(-120_000),
    endDate: isoOffset(-60_000),
    status: PromotionStatus.ACTIVE,
  });
  await service.create({
    shopId,
    type: PromotionType.FULL_DISCOUNT,
    name: '未启用满减',
    rule: { threshold: 3000, discount: 700 },
    status: PromotionStatus.INACTIVE,
  });
  await service.create({
    shopId: otherShopId,
    type: PromotionType.FULL_DISCOUNT,
    name: '其他店铺满减',
    rule: { threshold: 3000, discount: 900 },
    status: PromotionStatus.ACTIVE,
  });

  const promotions = await service.findAllByShop(shopId);

  assert.equal(promotions.length, 1);
  assert.equal(promotions[0].id, active.id);
  assert.equal(promotions[0].name, '当前满减');
  assert.deepEqual(promotions[0].rule, { threshold: 3000, discount: 500 });

  const managed = await service.findAllForManagement(shopId);
  assert.equal(managed.length, 4);
  assert.deepEqual(
    managed.map((item) => item.name),
    ['未启用满减', '已过期首单', '未来满减', '当前满减'],
  );
});

test('promotion create, findOne, update, and remove preserve fields and not-found behavior', async () => {
  const service = new PromotionService();
  const shopId = uniqueShopId('shop-promo-crud');
  const created = await service.create({
    shopId,
    type: PromotionType.FIRST_ORDER,
    name: '首单优惠',
    description: '新客专享',
    rule: { discount: 600 },
    status: PromotionStatus.INACTIVE,
  });
  const found = await service.findOne(created.id);
  const updated = await service.update(created.id, {
    name: '首单优惠已启用',
    description: '',
    rule: { discount: 800 },
    startDate: isoOffset(-60_000),
    endDate: isoOffset(60_000),
    status: PromotionStatus.ACTIVE,
  }, shopId);

  assert.equal(found.id, created.id);
  assert.equal(found.shopId, shopId);
  assert.equal(found.status, PromotionStatus.INACTIVE);
  assert.equal(updated.name, '首单优惠已启用');
  assert.equal(updated.description, undefined);
  assert.deepEqual(updated.rule, { discount: 800 });
  assert.equal(updated.status, PromotionStatus.ACTIVE);

  await service.remove(created.id, shopId);
  await assert.rejects(
    () => service.findOne(created.id),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === `促销 ${created.id} 不存在`,
  );
  await assert.rejects(
    () => service.update(created.id, { name: '不存在' }, shopId),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === `促销 ${created.id} 不存在`,
  );
  await assert.rejects(
    () => service.remove(created.id, shopId),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === `促销 ${created.id} 不存在`,
  );
});

test('promotion update and remove enforce shop ownership', async () => {
  const service = new PromotionService();
  const ownerShopId = uniqueShopId('shop-promo-owner');
  const otherShopId = uniqueShopId('shop-promo-other');
  const created = await service.create({
    shopId: ownerShopId,
    type: PromotionType.FULL_DISCOUNT,
    name: '店铺活动',
    rule: { threshold: 1000, discount: 100 },
    status: PromotionStatus.ACTIVE,
  });

  await assert.rejects(
    () => service.update(created.id, { name: '越权修改' }, otherShopId),
    (error: unknown) => error instanceof NotFoundException,
  );
  await assert.rejects(
    () => service.remove(created.id, otherShopId),
    (error: unknown) => error instanceof NotFoundException,
  );

  const unchanged = await service.findOne(created.id);
  assert.equal(unchanged.name, '店铺活动');
  await service.remove(created.id, ownerShopId);
});

test('promotion controller falls back to DEFAULT_SHOP_ID when admin shop is unbound', async () => {
  const service = new PromotionService();
  const controller = new PromotionController(service);

  // 未绑定 shopId 时 create 应落到 DEFAULT_SHOP_ID
  const createdResp = await controller.create({
    type: PromotionType.FULL_DISCOUNT,
    name: '默认店铺活动',
    rule: { threshold: 1000, discount: 100 },
    status: PromotionStatus.INACTIVE,
  } as any, undefined);
  assert.equal(createdResp.data.shopId, DEFAULT_SHOP_ID);

  const managed = await controller.findAllForManagement(undefined);
  assert.ok(managed.data.some((p) => p.id === createdResp.data.id));

  await controller.update(createdResp.data.id, { name: '已更新默认店铺活动' }, undefined);
  const updated = await service.findOne(createdResp.data.id);
  assert.equal(updated.name, '已更新默认店铺活动');
  await controller.remove(createdResp.data.id, undefined);
});

test('order creation applies the largest active full-discount promotion only', async () => {
  const promotionService = new PromotionService();
  const shopId = uniqueShopId('shop-promo-order-full');
  await promotionService.create({
    shopId,
    type: PromotionType.FULL_DISCOUNT,
    name: '满 30 减 5',
    rule: { threshold: 3000, discount: 500 },
    status: PromotionStatus.ACTIVE,
  });
  await promotionService.create({
    shopId,
    type: PromotionType.FULL_DISCOUNT,
    name: '满 30 减 8',
    rule: { threshold: 3000, discount: 800 },
    status: PromotionStatus.ACTIVE,
  });
  await promotionService.create({
    shopId,
    type: PromotionType.FULL_DISCOUNT,
    name: '未来满 30 减 20',
    rule: { threshold: 3000, discount: 2000 },
    startDate: isoOffset(60_000),
    status: PromotionStatus.ACTIVE,
  });
  const { service: orderService } = createOrderService({
    promotionService,
    menuItems: {
      'menu-promo-full': {
        id: 'menu-promo-full',
        name: '促销套餐',
        price: 3500,
      },
    },
  });

  const order = await orderService.create({
    shopId,
    userId: 'user-promo-full',
    deliveryType: DeliveryType.PICKUP,
    items: [{ menuItemId: 'menu-promo-full', name: '促销套餐', quantity: 1 }],
  });

  assert.equal(order.total, 2700);
});

test('order creation applies first-order promotion only before the user has orders', async () => {
  const promotionService = new PromotionService();
  const shopId = uniqueShopId('shop-promo-order-first');
  const userId = 'user-promo-first';
  await promotionService.create({
    shopId,
    type: PromotionType.FIRST_ORDER,
    name: '首单立减',
    rule: { discount: 700 },
    status: PromotionStatus.ACTIVE,
  });
  const { service: orderService } = createOrderService({
    promotionService,
    menuItems: {
      'menu-promo-first': {
        id: 'menu-promo-first',
        name: '首单套餐',
        price: 2000,
      },
    },
  });

  const first = await orderService.create({
    shopId,
    userId,
    deliveryType: DeliveryType.PICKUP,
    items: [{ menuItemId: 'menu-promo-first', name: '首单套餐', quantity: 1 }],
  });
  const second = await orderService.create({
    shopId,
    userId,
    deliveryType: DeliveryType.PICKUP,
    items: [{ menuItemId: 'menu-promo-first', name: '首单套餐', quantity: 1 }],
  });

  assert.equal(first.total, 1300);
  assert.equal(second.total, 2000);
});
