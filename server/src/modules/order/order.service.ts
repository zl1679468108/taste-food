import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus, DeliveryType } from '../../common/constants/enums';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderGateway } from './order.gateway';

export interface OrderItemRecord {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  specDesc: string;
  imageUrl: string;
}

export interface OrderRecord {
  id: string;
  shopId: string;
  userId: string;
  status: OrderStatus;
  total: number;
  deliveryType: DeliveryType;
  address?: string;
  tableNo?: string;
  remark?: string;
  contactName?: string;
  contactPhone?: string;
  items: OrderItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingCount: number;
  preparingCount: number;
  completedCount: number;
}

@Injectable()
export class OrderService {
  private orders: Map<string, OrderRecord> = new Map();

  constructor(
    @Inject(forwardRef(() => OrderGateway))
    private readonly orderGateway: OrderGateway,
  ) {}

  async create(dto: CreateOrderDto): Promise<OrderRecord> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('订单必须包含至少一个菜品');
    }

    const now = new Date().toISOString();
    const orderId = uuidv4();

    const total = dto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const items: OrderItemRecord[] = dto.items.map((item) => ({
      id: uuidv4(),
      orderId,
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      specDesc: item.specDesc || '',
      imageUrl: item.imageUrl || '',
    }));

    const order: OrderRecord = {
      id: orderId,
      shopId: dto.shopId,
      userId: dto.userId || '',
      status: OrderStatus.PENDING_PAYMENT,
      total,
      deliveryType: dto.deliveryType,
      address: dto.address,
      tableNo: dto.tableNo,
      remark: dto.remark,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      items,
      createdAt: now,
      updatedAt: now,
    };

    this.orders.set(orderId, order);

    // 发送 WebSocket 事件：新订单通知管理员
    try {
      this.orderGateway.emitOrderCreated(order);
    } catch (e) {
      // WebSocket 未初始化时不阻塞
    }

    return order;
  }

  async findById(id: string): Promise<OrderRecord> {
    const order = this.orders.get(id);
    if (!order) {
      throw new NotFoundException(`订单 ${id} 不存在`);
    }
    return order;
  }

  async findByUserId(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedData<OrderRecord>> {
    const userOrders = Array.from(this.orders.values())
      .filter((o) => o.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    return this.paginate(userOrders, page, pageSize);
  }

  async findByShopId(
    shopId: string,
    status?: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedData<OrderRecord>> {
    let filtered = Array.from(this.orders.values())
      .filter((o) => o.shopId === shopId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    if (status) {
      filtered = filtered.filter((o) => o.status === status);
    }

    return this.paginate(filtered, page, pageSize);
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderDto,
  ): Promise<OrderRecord> {
    const order = this.orders.get(id);
    if (!order) {
      throw new NotFoundException(`订单 ${id} 不存在`);
    }

    if (dto.status) {
      this.validateStatusTransition(order.status, dto.status);
      const previousStatus = order.status;
      order.status = dto.status;
      order.updatedAt = new Date().toISOString();
      this.orders.set(id, order);

      // 发送 WebSocket 事件：订单状态变更通知
      try {
        this.orderGateway.emitOrderUpdated(order, previousStatus);
      } catch (e) {
        // WebSocket 未初始化时不阻塞
      }

      return order;
    }

    if (dto.remark !== undefined) {
      order.remark = dto.remark;
    }

    order.updatedAt = new Date().toISOString();
    this.orders.set(id, order);
    return order;
  }

  async getTodayStats(shopId: string): Promise<OrderStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    const todayOrders = Array.from(this.orders.values()).filter(
      (o) =>
        o.shopId === shopId && o.createdAt >= todayStart,
    );

    const stats: OrderStats = {
      totalOrders: todayOrders.length,
      totalRevenue: todayOrders
        .filter((o) =>
          [OrderStatus.COMPLETED, OrderStatus.DELIVERING, OrderStatus.PREPARING].includes(o.status),
        )
        .reduce((sum, o) => sum + o.total, 0),
      pendingCount: todayOrders.filter(
        (o) => o.status === OrderStatus.PAID || o.status === OrderStatus.ACCEPTED,
      ).length,
      preparingCount: todayOrders.filter(
        (o) => o.status === OrderStatus.PREPARING,
      ).length,
      completedCount: todayOrders.filter(
        (o) => o.status === OrderStatus.COMPLETED,
      ).length,
    };

    return stats;
  }

  private validateStatusTransition(
    current: OrderStatus,
    next: OrderStatus,
  ): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED],
      [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING],
      [OrderStatus.PREPARING]: [OrderStatus.DELIVERING, OrderStatus.COMPLETED],
      [OrderStatus.DELIVERING]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REJECTED]: [],
    };

    const allowed = validTransitions[current];
    if (!allowed || !allowed.includes(next)) {
      throw new BadRequestException(
        `订单状态不能从 ${current} 变更为 ${next}`,
      );
    }
  }

  private paginate<T>(
    items: T[],
    page: number,
    pageSize: number,
  ): PaginatedData<T> {
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    return {
      items: paged,
      total: items.length,
      page,
      pageSize,
    };
  }
}
