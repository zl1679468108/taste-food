import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShopStatus } from '../src/common/constants/enums';
import { ShopService } from '../src/modules/shop/shop.service';
import {
  BusinessHours,
  emptyBusinessHours,
  isWithinBusinessHours,
  nextOpenHint,
  normalizeBusinessHours,
} from '../src/modules/shop/business-hours.util';

function alwaysOpenHours(): BusinessHours {
  return {
    sun: [{ start: '00:00', end: '23:59' }],
    mon: [{ start: '00:00', end: '23:59' }],
    tue: [{ start: '00:00', end: '23:59' }],
    wed: [{ start: '00:00', end: '23:59' }],
    thu: [{ start: '00:00', end: '23:59' }],
    fri: [{ start: '00:00', end: '23:59' }],
    sat: [{ start: '00:00', end: '23:59' }],
  };
}

function afternoonOnlyHours(): BusinessHours {
  return {
    sun: [],
    mon: [{ start: '14:00', end: '18:00' }],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
  };
}

test('create preserves explicit zero delivery fee and normalized business hours', async () => {
  const service = new ShopService();
  const shop = await service.create({
    name: '免配送费门店',
    description: '测试免配送费',
    address: '杭州市测试路 1 号',
    phone: '13800138000',
    deliveryRange: 3000,
    deliveryFee: 0,
    minOrderAmount: 0,
    businessHours: alwaysOpenHours(),
  });

  assert.equal(shop.name, '免配送费门店');
  assert.equal(shop.deliveryFee, 0);
  assert.equal(shop.minOrderAmount, 0);
  assert.equal(shop.status, ShopStatus.OPEN);
  assert.equal(shop.isOpenNow, true);
  assert.equal(shop.nextOpenHint, null);
  assert.deepEqual(shop.businessHours?.mon, [{ start: '00:00', end: '23:59' }]);
});

test('findOpenShops combines shop status and business hours', async () => {
  const service = new ShopService();
  const openShop = await service.create({
    name: '全天营业门店',
    deliveryFee: 0,
    businessHours: alwaysOpenHours(),
  });
  const closedByHours = await service.create({
    name: '无营业时段门店',
    businessHours: emptyBusinessHours(),
  });
  const closedByStatus = await service.create({
    name: '手动打烊门店',
    status: ShopStatus.CLOSED,
    businessHours: alwaysOpenHours(),
  });

  const openShops = await service.findOpenShops();
  const ids = openShops.map((shop) => shop.id);

  assert.equal(ids.includes(openShop.id), true);
  assert.equal(ids.includes(closedByHours.id), false);
  assert.equal(ids.includes(closedByStatus.id), false);
});

test('getBusinessHours returns status-aware open flag and next hint', async () => {
  const service = new ShopService();
  const shop = await service.create({
    name: '营业时段查询门店',
    businessHours: alwaysOpenHours(),
  });

  const beforeClose = await service.getBusinessHours(shop.id);
  const closed = await service.toggleStatus(shop.id);
  const afterClose = await service.getBusinessHours(shop.id);

  assert.equal(beforeClose.shopId, shop.id);
  assert.equal(beforeClose.status, ShopStatus.OPEN);
  assert.equal(beforeClose.isOpenNow, true);
  assert.equal(beforeClose.nextOpenHint, null);
  assert.equal(closed.status, ShopStatus.CLOSED);
  assert.equal(closed.isOpenNow, false);
  assert.equal(afterClose.status, ShopStatus.CLOSED);
  assert.equal(afterClose.isOpenNow, false);
  assert.equal(afterClose.nextOpenHint, '店铺已打烊');
});

test('update changes shop fields and rejects invalid business hours', async () => {
  const service = new ShopService();
  const shop = await service.create({
    name: '待更新门店',
    deliveryFee: 500,
    businessHours: alwaysOpenHours(),
  });

  const updated = await service.update(shop.id, {
    name: '已更新门店',
    description: '更新描述',
    address: '更新地址',
    phone: '13900139000',
    deliveryRange: 4500,
    deliveryFee: 0,
    minOrderAmount: 1200,
    businessHours: afternoonOnlyHours(),
  });

  assert.equal(updated.name, '已更新门店');
  assert.equal(updated.description, '更新描述');
  assert.equal(updated.address, '更新地址');
  assert.equal(updated.phone, '13900139000');
  assert.equal(updated.deliveryRange, 4500);
  assert.equal(updated.deliveryFee, 0);
  assert.equal(updated.minOrderAmount, 1200);
  assert.deepEqual(updated.businessHours?.mon, [{ start: '14:00', end: '18:00' }]);

  await assert.rejects(
    () => service.update(shop.id, {
      businessHours: {
        ...alwaysOpenHours(),
        mon: [{ start: '18:00', end: '12:00' }],
      },
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === 'businessHours.mon[0] start 必须早于 end',
  );
});

test('delete removes a shop and missing shops throw not found', async () => {
  const service = new ShopService();
  const shop = await service.create({
    name: '待删除门店',
    businessHours: alwaysOpenHours(),
  });

  await service.delete(shop.id);

  await assert.rejects(
    () => service.findById(shop.id),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === `店铺 ${shop.id} 不存在`,
  );
  await assert.rejects(
    () => service.delete(shop.id),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === `店铺 ${shop.id} 不存在`,
  );
});

test('business hour utilities parse JSON and produce deterministic hints', () => {
  const parsed = normalizeBusinessHours(JSON.stringify(afternoonOnlyHours()));
  const mondayNoonChina = new Date('2026-07-27T04:00:00.000Z');
  const mondayAfternoonChina = new Date('2026-07-27T07:00:00.000Z');

  assert.deepEqual(parsed.mon, [{ start: '14:00', end: '18:00' }]);
  assert.equal(isWithinBusinessHours(parsed, ShopStatus.OPEN, mondayNoonChina), false);
  assert.equal(isWithinBusinessHours(parsed, ShopStatus.OPEN, mondayAfternoonChina), true);
  assert.equal(nextOpenHint(parsed, ShopStatus.OPEN, mondayNoonChina), '今日 14:00 开始营业');

  assert.throws(
    () => normalizeBusinessHours('not-json'),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === 'businessHours 不是合法 JSON',
  );
  assert.throws(
    () => normalizeBusinessHours({
      ...alwaysOpenHours(),
      tue: [{ start: '9:00', end: '12:00' }],
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === 'businessHours.tue[0] 时间格式须为 HH:mm',
  );
});
