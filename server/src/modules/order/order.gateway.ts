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

interface DeliveryTrackEventPayload {
  orderId: string;
  shopId: string;
  userId: string;
  riderId?: string;
  riderDeliveryCount?: number;
  latitude: number;
  longitude: number;
  recordedAt: string;
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
   * 从客户端连接中提取并校验 Access Token（opaque 双 Token）。
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

  private riderRoom(): string {
    return 'role:rider';
  }

  /**
   * 将外送订单事件发送给未绑定当前店铺的骑手。
   * 店铺房间已经覆盖绑定该店铺的骑手，排除它可避免同一事件重复到达。
   */
  private emitToRidersOutsideShop(
    shopId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    this.server
      .to(this.riderRoom())
      .except(this.shopRoom(shopId))
      .emit(event, payload);
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
      // 平台管理员（无 shopId）允许连接：仅加入个人房间收通知，不进任何 shop 房间
      this.logger.log(
        `平台管理员 ${payload.userId} 无 shopId，仅加入个人房间接收通知: ${client.id}`,
      );
    }

  // 顾客额外加入个人房间（用于跨设备推送）
  if (payload.role === UserRole.CUSTOMER) {
    client.join(`user:${payload.userId}`);
  }

  // 公共个人房间：跨设备推送（通知、订单状态等）均发给 userId
  if (payload.userId) {
    client.join(`user:${payload.userId}`);
  }

  // 骑手加入通用房间：无 shopId 也能收到外送池事件；有 shopId 时双收
  if (payload.role === UserRole.RIDER) {
    client.join(this.riderRoom());
    this.logger.log(`客户端加入 role:rider 房间: ${client.id}`);
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
      riderDeliveryCount: order.riderDeliveryCount,
      status: order.status,
      total: order.total,
      deliveryFee: order.deliveryFee,
      deliveryType: order.deliveryType,
      address: order.address,
      shopLatitude: order.shopLatitude,
      shopLongitude: order.shopLongitude,
      deliveryLatitude: order.deliveryLatitude,
      deliveryLongitude: order.deliveryLongitude,
      tableNo: order.tableNo,
      remark: order.remark,
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      invoiceNeeded: !!order.invoiceNeeded,
      invoiceTitle: order.invoiceTitle,
      invoiceTaxNo: order.invoiceTaxNo,
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

  /**
   * 商家提醒用摘要字段：保证客户端无需深挖 order 对象即可展示横幅/角标。
   * 保留完整 order，兼容旧监听逻辑。
   */
  private buildOrderEventPayload(
    order: OrderRecord,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const serialized = this.serializeOrder(order);
    const items = order.items || [];
    // 件数优先用数量合计，便于商家横幅展示；无明细时回退 0
    const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return {
      // 商家提醒必填摘要字段（客户端可不依赖嵌套 order）
      orderId: order.id || '',
      shopId: order.shopId || '',
      total: Number(order.total) || 0,
      deliveryType: order.deliveryType || '',
      status: order.status || '',
      itemCount,
      contactName: order.contactName || '',
      contactPhone: order.contactPhone || '',
      tableNo: order.tableNo || '',
      address: order.address || '',
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      order: serialized,
      ...extra,
    };
  }

  emitOrderCreated(order: OrderRecord): void {
    if (!this.server) {
      this.logger.warn('[WS] server 未初始化，跳过 order:created 推送');
      return;
    }
    const payload = this.buildOrderEventPayload(order, { event: 'created' });
    // 仅推送给该店铺房间，避免跨店铺数据泄露
    this.server.to(this.shopRoom(order.shopId)).emit('order:created', payload);
    // 外送单额外推到骑手通用房间
    if (order.deliveryType === 'delivery') {
      this.emitToRidersOutsideShop(order.shopId, 'order:created', payload);
    }
    this.logger.log(
      `[WS] order:created orderId=${order.id}, shopId=${order.shopId}, total=${order.total}, deliveryType=${order.deliveryType}`,
    );
  }

  emitOrderUpdated(order: OrderRecord, previousStatus: string): void {
    if (!this.server) {
      this.logger.warn('[WS] server 未初始化，跳过 order:updated 推送');
      return;
    }
    const payload = this.buildOrderEventPayload(order, {
      event: 'updated',
      previousStatus,
    });

    // 推送给店铺房间（包含 admin/rider/该店铺内顾客）
    this.server.to(this.shopRoom(order.shopId)).emit('order:updated', payload);

    // 同时推送给订单所属顾客的个人房间（跨设备同步）
    this.server.to(`user:${order.userId}`).emit('order:updated', payload);

    // 外送单额外推到骑手通用房间
    if (order.deliveryType === 'delivery') {
      this.emitToRidersOutsideShop(order.shopId, 'order:updated', payload);
    }

    this.logger.log(
      `[WS] order:updated orderId=${order.id}, shopId=${order.shopId}, ${previousStatus} -> ${order.status}, total=${order.total}, deliveryType=${order.deliveryType}`,
    );
  }

  /**
   * 商家侧「新待处理订单」事件：订单进入 paid 时触发。
   * 同时发 order:new 与 order:paid，便于前端只订一种或两种。
   */
  emitOrderNew(order: OrderRecord, previousStatus = 'pending_payment'): void {
    if (!this.server) {
      this.logger.warn('[WS] server 未初始化，跳过 order:new/paid 推送');
      return;
    }
    const payload = this.buildOrderEventPayload(order, {
      event: 'new',
      previousStatus,
    });
    const room = this.shopRoom(order.shopId);
    this.server.to(room).emit('order:new', payload);
    this.server.to(room).emit('order:paid', payload);
    this.logger.log(
      `[WS] order:new/paid orderId=${order.id}, shopId=${order.shopId}, total=${order.total}, deliveryType=${order.deliveryType}`,
    );
  }

  emitDeliveryTrackUpdated(payload: DeliveryTrackEventPayload): void {
    if (!this.server) {
      this.logger.warn('[WS] server 未初始化，跳过 delivery:track 推送');
      return;
    }
    this.server.to(this.shopRoom(payload.shopId)).emit('delivery:track', payload);
    this.server.to(`user:${payload.userId}`).emit('delivery:track', payload);
    this.logger.log(
      `[WS] delivery:track orderId=${payload.orderId}, shopId=${payload.shopId}, recordedAt=${payload.recordedAt}`,
    );
  }

  /** 消息通知推送：发给对应用户（顾客/管理员/骑手） */
  emitNotificationToUser(payload: {
    userId: string;
    notification: {
      id: string;
      title: string;
      content: string;
      createdAt: string;
      type?: string;
      relatedType?: string;
      relatedId?: string;
      isRead?: boolean;
    };
  }): void {
    if (!this.server) {
      this.logger.warn('[WS] server 未初始化，跳过 notification:new 推送');
      return;
    }
    this.server
      .to(`user:${payload.userId}`)
      .emit('notification:new', {
        ...payload.notification,
        isRead: payload.notification.isRead ?? false,
      });
    this.logger.log(
      `[WS] notification:new userId=${payload.userId}, id=${payload.notification.id}, type=${payload.notification.type || ''}`,
    );
  }
}
