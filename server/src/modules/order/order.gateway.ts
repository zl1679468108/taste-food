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
    } else {
      const roomName = `user:${payload.userId}`;
      client.join(roomName);
      this.logger.log(`顾客加入房间 ${roomName}: ${client.id}`);
    }
  }

  /**
   * 发射新订单事件给管理员
   */
  emitOrderCreated(order: OrderRecord): void {
    this.server.to('admin').emit('order:created', {
      order,
    });
    this.logger.log(`[WS] 新订单推送: orderId=${order.id}, total=${order.total}`);
  }

  /**
   * 发射订单更新事件给管理员和顾客
   */
  emitOrderUpdated(order: OrderRecord, previousStatus: string): void {
    // 推送给管理员
    this.server.to('admin').emit('order:updated', {
      order,
      previousStatus,
    });

    // 推送给订单所属用户
    const userRoom = `user:${order.userId}`;
    this.server.to(userRoom).emit('order:updated', {
      order,
      previousStatus,
    });

    this.logger.log(
      `[WS] 订单状态推送: orderId=${order.id}, ${previousStatus} -> ${order.status}`,
    );
  }
}
