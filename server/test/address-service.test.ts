import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AddressService } from '../src/modules/address/address.service';

function createAddressService() {
  return new AddressService();
}

function uniqueUser(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

type AddressDtoInput = {
  shopId: string;
  contactName: string;
  contactPhone: string;
  detail: string;
  tag: string;
  isDefault: boolean;
  latitude: number;
  longitude: number;
};

function addressDto(overrides: Partial<AddressDtoInput> = {}) {
  return {
    contactName: '  张三  ',
    contactPhone: ' 13800138000 ',
    detail: ' 杭州市西湖区测试地址 ',
    tag: ' 家 ',
    // 地址坐标为地图选点必填项（GCJ-02），此处取杭州西湖区参考坐标
    latitude: 30.259244,
    longitude: 120.130229,
    ...overrides,
  };
}

test('first address becomes default and fields are trimmed', async () => {
  const service = createAddressService();
  const userId = uniqueUser('address-first');

  const address = await service.create(userId, addressDto());

  assert.equal(address.userId, userId);
  assert.equal(address.contactName, '张三');
  assert.equal(address.contactPhone, '13800138000');
  assert.equal(address.detail, '杭州市西湖区测试地址');
  assert.equal(address.tag, '家');
  assert.equal(address.isDefault, true);
});

test('setDefault keeps only one default address for a user', async () => {
  const service = createAddressService();
  const userId = uniqueUser('address-default');

  const first = await service.create(userId, addressDto({ tag: '家' }));
  const second = await service.create(userId, addressDto({
    contactName: '李四',
    contactPhone: '13900139000',
    detail: '杭州市上城区测试地址',
    tag: '公司',
  }));

  assert.equal(first.isDefault, true);
  assert.equal(second.isDefault, false);

  const updated = await service.setDefault(second.id, userId);
  const list = await service.findByUserId(userId);

  assert.equal(updated.id, second.id);
  assert.equal(updated.isDefault, true);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, second.id);
  assert.equal(list[0].isDefault, true);
  assert.equal(list[1].id, first.id);
  assert.equal(list[1].isDefault, false);
});

test('removing the default address promotes the newest remaining address', async () => {
  const service = createAddressService();
  const userId = uniqueUser('address-remove-default');

  const first = await service.create(userId, addressDto({ tag: '家' }));
  const second = await service.create(userId, addressDto({
    contactName: '王五',
    contactPhone: '13700137000',
    detail: '杭州市拱墅区测试地址',
    tag: '备用',
  }));

  await service.setDefault(first.id, userId);
  await service.remove(first.id, userId);

  const list = await service.findByUserId(userId);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, second.id);
  assert.equal(list[0].isDefault, true);
});

test('findByUserId filters by user and optional shop scope', async () => {
  const service = createAddressService();
  const userId = uniqueUser('address-filter');
  const otherUserId = uniqueUser('address-filter-other');

  const shared = await service.create(userId, addressDto({ tag: '通用' }));
  const shopA = await service.create(userId, addressDto({
    shopId: 'shop-a',
    contactName: '赵六',
    contactPhone: '13600136000',
    detail: 'shop-a 专用地址',
    tag: '店 A',
  }));
  await service.create(userId, addressDto({
    shopId: 'shop-b',
    contactName: '钱七',
    contactPhone: '13500135000',
    detail: 'shop-b 专用地址',
    tag: '店 B',
  }));
  await service.create(otherUserId, addressDto({
    contactName: '其他用户',
    contactPhone: '13400134000',
    detail: '其他用户地址',
  }));

  const allForUser = await service.findByUserId(userId);
  const shopAList = await service.findByUserId(userId, 'shop-a');

  assert.equal(allForUser.length, 3);
  assert.deepEqual(
    new Set(shopAList.map((item) => item.id)),
    new Set([shared.id, shopA.id]),
  );
});

test('address access is isolated by user', async () => {
  const service = createAddressService();
  const ownerId = uniqueUser('address-owner');
  const otherUserId = uniqueUser('address-other');
  const address = await service.create(ownerId, addressDto());

  await assert.rejects(
    () => service.findByIdForUser(address.id, otherUserId),
    (error: unknown) =>
      error instanceof ForbiddenException &&
      error.message === '无权访问该地址',
  );

  await assert.rejects(
    () => service.remove(address.id, otherUserId),
    (error: unknown) =>
      error instanceof ForbiddenException &&
      error.message === '无权访问该地址',
  );
});

test('update rejects empty required fields and missing addresses return not found', async () => {
  const service = createAddressService();
  const userId = uniqueUser('address-update');
  const address = await service.create(userId, addressDto());

  await assert.rejects(
    () => service.update(address.id, userId, { contactName: '   ' }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '联系人与地址不能为空',
  );

  await assert.rejects(
    () => service.findByIdForUser('missing-address-id', userId),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === '地址不存在',
  );
});
