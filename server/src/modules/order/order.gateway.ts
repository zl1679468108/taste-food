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
import { AuthService } from '../auth/auth.service';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

interface JoinRoomPayload {
  userId?: string;
  role?: string;
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

  constructor(private readonly authService: AuthService) {}

  /**
   * 从客户端连接中提取并校验 JWT token。
   * token 可通过 handshake.auth.token 或 handshake.query.token 传入。
   * 校验失败返回 null，调用方应断开连接。
   */
  private async verifyClient(client: Socket): Promise<CurrentUserPayload | null> {
    const token =
      (client.handshake.auth as { token?: string })?.token ||
      (client.handshake.query as { token?: string })?.token;

    if (!token) {
      this.logger.warn(`客户端 ${client.id} 未提供 token，拒绝连接`);
      return null;
    }

    try {
      const payload = await this.authService.validateToken(token);
      return payload;
    } catch (e) {
      this.logger.warn(`客户端 ${client.id} token 校验失败: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    const payload = await this.verifyClient(client);
    if (!payload) {
      client.emit('error', { message: '未认证，连接被拒绝' });
      client.disconnect();
      return;
    }

    // 将认证信息存储到 client.data 供后续使用
    client.data.user = payload;
    this.logger.log(
      `客户端连接: client=${client.id}, userId=${payload.userId}, role=${payload.role}`,
    );

    // 根据认证身份自动加入对应房间，不信任客户端自报身份
    if (payload.role === 'admin') {
      client.join('admin');
      this.logger.log(`管理员加入 admin 房间: ${client.id}`);
    } else if (payload.role === 'rider') {
      client.join('rider');
      this.logger.log(`骑手加入 rider 房间: ${client.id}`);
    }
    // 顾客加入自己的个人房间
    client.join(`user:${payload.userId}`);
  }

  handleDisconnect(client: Socket): void {
    const user = client.data?.user as CurrentUserPayload | undefined;
    this.logger.log(
      `客户端断开: ${client.id}${user ? `, userId=${user.userId}` : ''}`,
    );
  }

  /**
   * 显式加入房间接口（向后兼容）。
   * 身份信息以连接时校验的 token 为准，忽略 payload 中的 userId/role。
   */
  @SubscribeMessage('order:joined')
  handleJoinRoom(
    @MessageBody() _payload: JoinRoomPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    const user = client.data?.user as CurrentUserPayload | undefined;
    if (!user) {
      client.emit('error', { message: '未认证' });
      client.disconnect();
      return;
    }

    // 房间已在 handleConnection 中根据 token 加入，此处仅确认
    this.logger.log(
      `客户端确认加入房间: client=${client.id}, userId=${user.userId}, role=${user.role}`,
    );
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
