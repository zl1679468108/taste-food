import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OrderRecord } from './order.service';

interface JoinRoomPayload {
  userId: string;
  role: string;
}

@WebSocketGateway({
  namespace: '/orders',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrderGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`客户端连接: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`客户端断开: ${client.id}`);
  }

  @SubscribeMessage('order:joined')
  handleJoinRoom(
    @MessageBody() payload: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    this.logger.log(`客户端加入房间: client=${client.id}, userId=${payload.userId}, role=${payload.role}`);

    if (payload.role === 'admin') {
      client.join('admin');
      this.logger.log(`管理员加入admin房间: ${client.id}`);
    } else if (payload.role === 'rider') {
      client.join('rider');
      this.logger.log(`骑手加入rider房间: ${client.id}`);
    } else {
      const roomName = `user:${payload.userId}`;
      client.join(roomName);
      this.logger.log(`顾客加入房间 ${roomName}: ${client.id}`);
    }
  }

  /** 将 OrderRecord 转为纯字面量对象，避免 socket.io 序列化问题 */
  private serializeOrder(order: OrderRecord): Record<string, any> {
    return {
      id: order.id,
      shopId: order.shopId,
      userId: order.userId,
      riderId: order.riderId,
      status: order.status,
      total: order.total,
      deliveryFee: order.deliveryFee,
      deliveryType: order.deliveryType,
      address: order.address,
      tableNo: order.tableNo,
      remark: order.remark,
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      items: (order.items || []).map((item) => ({
        id: item.id,
        orderId: item.orderId,
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        specDesc: item.specDesc,
        imageUrl: item.imageUrl,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  emitOrderCreated(order: OrderRecord): void {
    const serialized = this.serializeOrder(order);
    this.server.to('admin').emit('order:created', {
      order: serialized,
    });
    this.logger.log(`[WS] 新订单推送: orderId=${order.id}, total=${order.total}`);
  }

  emitOrderUpdated(order: OrderRecord, previousStatus: string): void {
    const serialized = this.serializeOrder(order);

    this.server.to('admin').emit('order:updated', {
      order: serialized,
      previousStatus,
    });

    const userRoom = `user:${order.userId}`;
    this.server.to(userRoom).emit('order:updated', {
      order: serialized,
      previousStatus,
    });

    // 推送给骑手房间
    this.server.to('rider').emit('order:updated', {
      order: serialized,
      previousStatus,
    });

    this.logger.log(
      `[WS] 订单状态推送: orderId=${order.id}, ${previousStatus} -> ${order.status}`,
    );
  }
}
