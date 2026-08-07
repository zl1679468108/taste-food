import { DeliveryType, MenuItemStatus, OrderStatus, ShopStatus } from '../../src/common/constants/enums';
import { OrderService, OrderRecord } from '../../src/modules/order/order.service';

type TestShop = {
  id: string;
  status: ShopStatus;
  isOpenNow?: boolean;
  deliveryFee: number;
  minOrderAmount: number;
};

type TestMenuItem = {
  id: string;
  shopId?: string;
  name: string;
  price: number;
  imageUrl?: string;
  status?: MenuItemStatus;
};

type TestSpecOption = {
  id: string;
  name: string;
  priceAdjust: number;
};

type TestSpecGroup = {
  id: string;
  name: string;
  options: TestSpecOption[];
};

type TestOrderServiceOptions = {
  shop?: Partial<TestShop>;
  menuItems?: Record<string, TestMenuItem>;
  specGroupsByMenuItemId?: Record<string, TestSpecGroup[]>;
  promotions?: unknown[];
  promotionService?: unknown;
};

export type OrderUpdatedEvent = {
  order: OrderRecord;
  previousStatus: string;
};

export type DeliveryTrackEvent = {
  orderId: string;
  shopId: string;
  userId: string;
  riderId?: string;
  riderDeliveryCount?: number;
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export function createOrderService(options: TestOrderServiceOptions = {}) {
  const orderCreatedEvents: OrderRecord[] = [];
  const orderUpdatedEvents: OrderUpdatedEvent[] = [];
  const orderNewEvents: OrderUpdatedEvent[] = [];
  const deliveryTrackEvents: DeliveryTrackEvent[] = [];
  const defaultShop: TestShop = {
    id: 'shop-test',
    status: ShopStatus.OPEN,
    isOpenNow: true,
    deliveryFee: 0,
    minOrderAmount: 0,
    ...options.shop,
  };
  const menuItems = options.menuItems || {};
  const specGroupsByMenuItemId = options.specGroupsByMenuItemId || {};

  // Track the last queried shopId for menu service mock
  let currentShopId = defaultShop.id;

  const gateway = {
    emitOrderCreated: (order: OrderRecord) => orderCreatedEvents.push(order),
    emitOrderUpdated: (order: OrderRecord, previousStatus: string) => {
      orderUpdatedEvents.push({ order, previousStatus });
    },
    emitOrderNew: (order: OrderRecord, previousStatus: string) => {
      orderNewEvents.push({ order, previousStatus });
    },
    emitDeliveryTrackUpdated: (event: DeliveryTrackEvent) => deliveryTrackEvents.push(event),
  };
  const promotionService = options.promotionService || {
    findAllByShop: async () => options.promotions || [],
  };
  const shopService = {
    findById: async (shopId: string) => {
      currentShopId = shopId; // Track shopId for menu service
      return {
        ...defaultShop,
        id: shopId,
      };
    },
  };
  const menuService = {
    getMenuItemById: async (menuItemId: string) => {
      const item = menuItems[menuItemId] || {
        id: menuItemId,
        name: `菜品-${menuItemId}`,
        price: 1200,
        imageUrl: '',
      };
      return {
        ...item,
        status: item.status || MenuItemStatus.ACTIVE,
        shopId: item.shopId || currentShopId,
        specs: specGroupsByMenuItemId[menuItemId] || [],
      };
    },
    getMenuItemSpecs: async (menuItemId: string) => specGroupsByMenuItemId[menuItemId] || [],
    getMenuItemsByIds: async (menuItemIds: string[]) => {
      const map = new Map();
      for (const id of menuItemIds) {
        const item = menuItems[id] || {
          id,
          name: `菜品-${id}`,
          price: 1200,
          imageUrl: '',
        };
        map.set(id, {
          ...item,
          status: item.status || MenuItemStatus.ACTIVE,
          shopId: item.shopId || currentShopId,
          specs: specGroupsByMenuItemId[id] || [],
        });
      }
      return map;
    },
  };
  const addressService = {
    findByUserId: async () => [],
  };
  // 站内消息：记录写入内容供断言，失败不应影响订单主流程
  const inboxMessages: Array<Record<string, unknown>> = [];
  const inboxService = {
    create: async (payload: Record<string, unknown>) => {
      inboxMessages.push(payload);
      return payload;
    },
  };

  const service = new OrderService(
    gateway as never,
    promotionService as never,
    shopService as never,
    menuService as never,
    addressService as never,
    inboxService as never,
  );

  return {
    service,
    orderCreatedEvents,
    orderUpdatedEvents,
    orderNewEvents,
    deliveryTrackEvents,
    inboxMessages,
  };
}

export async function createDeliveryOrder(service: OrderService) {
  return service.create({
    shopId: `shop-${Date.now()}-${Math.random()}`,
    userId: `user-${Date.now()}-${Math.random()}`,
    deliveryType: DeliveryType.DELIVERY,
    address: '杭州市西湖区测试地址 1 号',
    deliveryLatitude: 30.2741,
    deliveryLongitude: 120.1551,
    contactName: '测试用户',
    contactPhone: '13800138000',
    items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
  } as any);
}

export async function createPickupOrder(service: OrderService) {
  return service.create({
    shopId: `shop-${Date.now()}-${Math.random()}`,
    userId: `user-${Date.now()}-${Math.random()}`,
    deliveryType: DeliveryType.PICKUP,
    items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
  });
}

export async function moveOrderThrough(
  service: OrderService,
  orderId: string,
  statuses: OrderStatus[],
) {
  let order = await service.findById(orderId);
  for (const status of statuses) {
    order = await service.updateStatus(order.id, { status });
  }
  return order;
}
