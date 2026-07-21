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
import { UserRole } from '../../common/constants/enums';

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
  // 心跳配置：避免长时间空闲连接占用资源
  pingInterval: 25_000,
  pingTimeout: 10_000,
})
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrderGateway.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * 从客户端连接中提取并校验 JWT token。
   * 仅支持 handshake.auth.token 传递，禁止通过 URL query 传递（避免 token 泄漏到日志/反代）。
   * 校验失败返回 null，调用方应断开连接。
   */
  private async verifyClient(client: Socket): Promise<CurrentUserPayload | null> {
    const token = (client.handshake.auth as { token?: string })?.token;

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

  /**
   * 多租户房间名：shop:${shopId}
   * admin/rider/顾客均按 shopId 隔离，避免跨店铺数据泄露。
   */
  private shopRoom(shopId: string): string {
    return `shop:${shopId}`;
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
      `客户端连接: client=${client.id}, userId=${payload.userId}, role=${payload.role}, shopId=${payload.shopId || '-'}`,
    );

    // 多租户隔离：按 shopId 加入 shop:${shopId} 房间
    // admin 必须有 shopId 才能加入对应店铺房间；rider/顾客同理
    // 不信任客户端自报身份，房间归属完全由 JWT 决定
    if (payload.shopId) {
      const room = this.shopRoom(payload.shopId);
      client.join(room);
      this.logger.log(`客户端加入 ${room} 房间: ${client.id} (role=${payload.role})`);
    } else if (payload.role === UserRole.ADMIN) {
      // admin 缺失 shopId 视为配置异常，拒绝连接避免越权
      this.logger.warn(`管理员 ${payload.userId} 缺失 shopId，拒绝连接`);
      client.emit('error', { message: '管理员账号未绑定店铺' });
      client.disconnect();
      return;
    }

    // 顾客额外加入个人房间（用于跨设备推送）
    if (payload.role === UserRole.CUSTOMER) {
      client.join(`user:${payload.userId}`);
    }
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
    if (!this.server) {
      this.logger.warn('[WS] server 未初始化，跳过 order:created 推送');
      return;
    }
    const serialized = this.serializeOrder(order);
    // 仅推送给该店铺房间，避免跨店铺数据泄露
    this.server.to(this.shopRoom(order.shopId)).emit('order:created', {
      order: serialized,
    });
    this.logger.log(`[WS] 新订单推送: orderId=${order.id}, shopId=${order.shopId}, total=${order.total}`);
  }

  emitOrderUpdated(order: OrderRecord, previousStatus: string): void {
    if (!this.server) {
      this.logger.warn('[WS] server 未初始化，跳过 order:updated 推送');
      return;
    }
    const serialized = this.serializeOrder(order);

    // 推送给店铺房间（包含 admin/rider/该店铺内顾客）
    this.server.to(this.shopRoom(order.shopId)).emit('order:updated', {
      order: serialized,
      previousStatus,
    });

    // 同时推送给订单所属顾客的个人房间（跨设备同步）
    this.server.to(`user:${order.userId}`).emit('order:updated', {
      order: serialized,
      previousStatus,
    });

    this.logger.log(
      `[WS] 订单状态推送: orderId=${order.id}, shopId=${order.shopId}, ${previousStatus} -> ${order.status}`,
    );
  }
}
