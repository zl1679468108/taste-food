import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { DeliveryType, ShopStatus } from '../src/common/constants/enums';
import { createOrderService } from './helpers/order-service';

test('create order ignores client price and uses server menu price plus spec adjustments', async () => {
  const { service } = createOrderService({
    menuItems: {
      'menu-burger': {
        id: 'menu-burger',
        name: '招牌汉堡',
        price: 1800,
        imageUrl: 'burger.png',
      },
    },
    specGroupsByMenuItemId: {
      'menu-burger': [{
        id: 'spec-size',
        name: '规格',
        options: [
          { id: 'large', name: '大份', priceAdjust: 300 },
          { id: 'cheese', name: '加芝士', priceAdjust: 200 },
        ],
      }],
    },
  });

  const order = await service.create({
    shopId: 'shop-price',
    userId: 'user-price',
    deliveryType: DeliveryType.PICKUP,
    items: [{
      menuItemId: 'menu-burger',
      name: '客户端菜名不可信',
      quantity: 2,
      price: 1,
      specOptionIds: ['large', 'cheese', 'large'],
      specDesc: '大份/加芝士',
    }],
  });

  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].name, '招牌汉堡');
  assert.equal(order.items[0].price, 2300);
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.total, 4600);
});

test('create order rejects spec options that do not belong to the menu item', async () => {
  const { service } = createOrderService({
    menuItems: {
      'menu-noodle': {
        id: 'menu-noodle',
        name: '牛肉面',
        price: 1500,
      },
    },
    specGroupsByMenuItemId: {
      'menu-noodle': [{
        id: 'spec-spicy',
        name: '辣度',
        options: [{ id: 'mild', name: '微辣', priceAdjust: 0 }],
      }],
    },
  });

  await assert.rejects(
    () => service.create({
      shopId: 'shop-spec',
      userId: 'user-spec',
      deliveryType: DeliveryType.PICKUP,
      items: [{
        menuItemId: 'menu-noodle',
        name: '牛肉面',
        quantity: 1,
        specOptionIds: ['extra-beef'],
      }],
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '菜品 牛肉面 不包含规格选项 extra-beef',
  );
});

test('delivery order uses shop delivery fee and enforces min order amount', async () => {
  const { service } = createOrderService({
    shop: {
      deliveryFee: 500,
      minOrderAmount: 3000,
    },
    menuItems: {
      'menu-rice': {
        id: 'menu-rice',
        name: '盖饭',
        price: 3200,
      },
    },
  });

  const order = await service.create({
    shopId: 'shop-delivery',
    userId: 'user-delivery',
    deliveryType: DeliveryType.DELIVERY,
    address: '杭州市西湖区测试地址 2 号',
    items: [{
      menuItemId: 'menu-rice',
      name: '盖饭',
      quantity: 1,
      price: 1,
    }],
  });

  assert.equal(order.deliveryFee, 500);
  assert.equal(order.total, 3700);
});

test('delivery order rejects totals below shop min order amount', async () => {
  const { service } = createOrderService({
    shop: {
      deliveryFee: 500,
      minOrderAmount: 3000,
    },
    menuItems: {
      'menu-tea': {
        id: 'menu-tea',
        name: '奶茶',
        price: 1200,
      },
    },
  });

  await assert.rejects(
    () => service.create({
      shopId: 'shop-min',
      userId: 'user-min',
      deliveryType: DeliveryType.DELIVERY,
      address: '杭州市西湖区测试地址 3 号',
      items: [{
        menuItemId: 'menu-tea',
        name: '奶茶',
        quantity: 2,
      }],
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '订单金额 2400 分未达到起送价 3000 分',
  );
});

test('create order rejects closed or non-business-hour shops', async () => {
  const { service: closedService } = createOrderService({
    shop: {
      status: ShopStatus.CLOSED,
      isOpenNow: undefined,
    },
  });
  const { service: restingService } = createOrderService({
    shop: {
      status: ShopStatus.OPEN,
      isOpenNow: false,
    },
  });

  for (const service of [closedService, restingService]) {
    await assert.rejects(
      () => service.create({
        shopId: 'shop-closed',
        userId: 'user-closed',
        deliveryType: DeliveryType.PICKUP,
        items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
      }),
      (error: unknown) =>
        error instanceof BadRequestException &&
        error.message === '店铺休息中，暂不可下单',
    );
  }
});

test('create order requires address for delivery and table number for dine-in', async () => {
  const { service } = createOrderService();

  await assert.rejects(
    () => service.create({
      shopId: 'shop-required',
      userId: 'user-required',
      deliveryType: DeliveryType.DELIVERY,
      items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '外送订单必须提供配送地址',
  );

  await assert.rejects(
    () => service.create({
      shopId: 'shop-required',
      userId: 'user-required',
      deliveryType: DeliveryType.DINE_IN,
      items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
    }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '堂食订单必须选择桌号',
  );
});

test('create order accepts payload without client-provided item name', async () => {
  const { service } = createOrderService({
    menuItems: {
      'menu-no-name': {
        id: 'menu-no-name',
        name: '服务端菜名',
        price: 1500,
        imageUrl: '',
      },
    },
  });

  const order = await service.create({
    shopId: 'shop-no-name',
    userId: 'user-no-name',
    deliveryType: DeliveryType.PICKUP,
    items: [{
      menuItemId: 'menu-no-name',
      quantity: 1,
    }],
  });

  assert.equal(order.items[0].name, '服务端菜名');
  assert.equal(order.items[0].price, 1500);
});
