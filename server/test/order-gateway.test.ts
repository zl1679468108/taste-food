import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderGateway } from '../src/modules/order/order.gateway';
import { DeliveryType, OrderStatus } from '../src/common/constants/enums';
import { OrderRecord } from '../src/modules/order/order.service';

interface BroadcastCall {
  room: string;
  excludedRooms: string[];
  event?: string;
  payload?: Record<string, unknown>;
}

function createGateway() {
  const calls: BroadcastCall[] = [];
  const server = {
    to(room: string) {
      const call: BroadcastCall = { room, excludedRooms: [] };
      calls.push(call);
      const operator = {
        except(excludedRoom: string) {
          call.excludedRooms.push(excludedRoom);
          return operator;
        },
        emit(event: string, payload: Record<string, unknown>) {
          call.event = event;
          call.payload = payload;
        },
      };
      return operator;
    },
  };
  const gateway = new OrderGateway({} as never);
  gateway.server = server as never;
  return { gateway, calls };
}

function makeOrder(deliveryType: DeliveryType): OrderRecord {
  return {
    id: 'order-gateway-1',
    shopId: 'shop-gateway-1',
    userId: 'user-gateway-1',
    status: OrderStatus.PREPARING,
    total: 1000,
    deliveryFee: deliveryType === DeliveryType.DELIVERY ? 500 : 0,
    deliveryType,
    items: [],
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
  };
}

test('外送订单创建事件排除已在店铺房间的骑手', () => {
  const { gateway, calls } = createGateway();

  gateway.emitOrderCreated(makeOrder(DeliveryType.DELIVERY));

  const shopCall = calls.find((call) => call.room === 'shop:shop-gateway-1');
  const riderCall = calls.find((call) => call.room === 'role:rider');
  assert.equal(shopCall?.event, 'order:created');
  assert.equal(riderCall?.event, 'order:created');
  assert.deepEqual(riderCall?.excludedRooms, ['shop:shop-gateway-1']);
});

test('非外送订单不广播到骑手通用房间，外送状态更新同样排除店铺骑手', () => {
  const pickup = createGateway();
  pickup.gateway.emitOrderCreated(makeOrder(DeliveryType.PICKUP));
  assert.equal(pickup.calls.some((call) => call.room === 'role:rider'), false);

  const delivery = createGateway();
  delivery.gateway.emitOrderUpdated(makeOrder(DeliveryType.DELIVERY), OrderStatus.ACCEPTED);
  const riderCall = delivery.calls.find((call) => call.room === 'role:rider');
  assert.equal(riderCall?.event, 'order:updated');
  assert.deepEqual(riderCall?.excludedRooms, ['shop:shop-gateway-1']);
});
