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
    findById: async (shopId: string) => ({
      ...defaultShop,
      id: shopId,
    }),
  };
  const menuService = {
    getMenuItemById: async (menuItemId: string) => (
      menuItems[menuItemId] || {
        id: menuItemId,
        name: `菜品-${menuItemId}`,
        price: 1200,
        imageUrl: '',
      }
    ),
    getMenuItemSpecs: async (menuItemId: string) => specGroupsByMenuItemId[menuItemId] || [],
  };
  const addressService = {
    findByUserId: async () => [],
  };

  const service = new OrderService(
    gateway as never,
    promotionService as never,
    shopService as never,
    menuService as never,
    addressService as never,
  );

  return {
    service,
    orderCreatedEvents,
    orderUpdatedEvents,
    orderNewEvents,
    deliveryTrackEvents,
  };
}

export async function createDeliveryOrder(service: OrderService) {
  return service.create({
    shopId: `shop-${Date.now()}-${Math.random()}`,
    userId: `user-${Date.now()}-${Math.random()}`,
    deliveryType: DeliveryType.DELIVERY,
    address: '杭州市西湖区测试地址 1 号',
    items: [{ menuItemId: 'menu-1', name: '测试菜品', quantity: 1 }],
  });
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
