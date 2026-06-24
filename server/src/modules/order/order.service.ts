import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus, DeliveryType, PromotionType } from '../../common/constants/enums';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderGateway } from './order.gateway';
import { PromotionService } from '../promotion/promotion.service';
import { supabase, hasSupabase } from '../../database/supabase.client';

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
  riderId?: string; // 增加骑手 ID
  status: OrderStatus;
  total: number;
  deliveryFee: number;
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

// Supabase 行类型
interface OrderRow {
  id: string;
  shop_id: string;
  user_id: string;
  rider_id?: string;
  status: string;
  total: number;
  delivery_fee?: number;
  delivery_type: string;
  address?: string;
  table_no?: string;
  remark?: string;
  contact_name?: string;
  contact_phone?: string;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  spec_desc?: string;
  image_url?: string;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingCount: number;
  preparingCount: number;
  completedCount: number;
}

// Memory fallback storage
const memoryOrders: Map<string, OrderRecord> = new Map();

@Injectable()
export class OrderService {
  constructor(
    @Inject(forwardRef(() => OrderGateway))
    private readonly orderGateway: OrderGateway,
    private readonly promotionService: PromotionService,
  ) {}

  private toRecord(row: any): OrderRecord {
    return {
      id: row.id,
      shopId: row.shop_id,
      userId: row.user_id,
      riderId: row.rider_id || undefined,
      status: row.status as OrderStatus,
      total: row.total,
      deliveryFee: row.delivery_fee || 0,
      deliveryType: row.delivery_type as DeliveryType,
      address: row.address,
      tableNo: row.table_no,
      remark: row.remark,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      items: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async fetchItems(orderId: string): Promise<OrderItemRecord[]> {
    if (!hasSupabase() || !supabase) return [];
    const { data, error } = await supabase
      .from('tf_order_items')
      .select('id, order_id, menu_item_id, name, quantity, price, spec_desc, image_url')
      .eq('order_id', orderId)
      .order('id');
    if (error) return [];
    return (data || []).map((row: OrderItemRow) => ({
      id: row.id,
      orderId: row.order_id,
      menuItemId: row.menu_item_id,
      name: row.name,
      quantity: row.quantity,
      price: row.price,
      specDesc: row.spec_desc || '',
      imageUrl: row.image_url || '',
    }));
  }

  private async fetchItemsForOrders(orderIds: string[]): Promise<Map<string, OrderItemRecord[]>> {
    if (!hasSupabase() || !supabase || orderIds.length === 0) return new Map();
    
    const { data, error } = await supabase
      .from('tf_order_items')
      .select('id, order_id, menu_item_id, name, quantity, price, spec_desc, image_url')
      .in('order_id', orderIds)
      .order('id');
    
    if (error) return new Map();
    
    const itemsMap = new Map<string, OrderItemRecord[]>();
    const items = (data || []).map((row: OrderItemRow) => ({
      id: row.id,
      orderId: row.order_id,
      menuItemId: row.menu_item_id,
      name: row.name,
      quantity: row.quantity,
      price: row.price,
      specDesc: row.spec_desc || '',
      imageUrl: row.image_url || '',
    }));
    
    // 按 orderId 分组
    for (const item of items) {
      const existing = itemsMap.get(item.orderId) || [];
      existing.push(item);
      itemsMap.set(item.orderId, existing);
    }
    
    return itemsMap;
  }

  async create(dto: CreateOrderDto): Promise<OrderRecord> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('订单必须包含至少一个菜品');
    }

    // 堂食必须有桌号，外送必须有地址
    if (dto.deliveryType === DeliveryType.DINE_IN && !dto.tableNo) {
      throw new BadRequestException('堂食订单必须选择桌号');
    }
    if (dto.deliveryType === DeliveryType.DELIVERY && !dto.address) {
      throw new BadRequestException('外送订单必须提供配送地址');
    }

    const now = new Date().toISOString();
    const orderId = uuidv4();
    const deliveryFee = dto.deliveryFee || 0;
    const itemsTotal = dto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // 计算优惠
    let discountAmount = 0;
    try {
      const activePromotions = await this.promotionService.findAllByShop(dto.shopId);
      for (const promo of activePromotions) {
        if (promo.type === PromotionType.FULL_DISCOUNT) {
          const rule = promo.rule || {};
          if (itemsTotal >= (rule.threshold || 0)) {
            discountAmount = Math.max(discountAmount, rule.discount || 0);
          }
        } else if (promo.type === PromotionType.FIRST_ORDER) {
          // 检查是否为首单
          const userOrders = await this.findByUserId(dto.userId || '', 1, 1);
          if (userOrders.total === 0) {
            discountAmount = Math.max(discountAmount, promo.rule?.discount || 0);
          }
        }
      }
    } catch (e) {
      console.warn('优惠计算失败:', e instanceof Error ? e.message : e);
    }

    const total = Math.max(0, itemsTotal + deliveryFee - discountAmount);

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
      deliveryFee,
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

    if (hasSupabase() && supabase) {
      // Atomic order creation: single RPC call wraps order + items + sales in one transaction
      const orderDate = new Date().toISOString().split('T')[0];
      const itemsJsonb = JSON.stringify(items.map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        specDesc: item.specDesc,
        imageUrl: item.imageUrl,
      })));

      const { error: rpcErr } = await supabase.rpc('atomic_create_order', {
        p_order_id: orderId,
        p_shop_id: dto.shopId,
        p_user_id: dto.userId || '',
        p_total: total,
        p_delivery_fee: deliveryFee,
        p_delivery_type: dto.deliveryType,
        p_address: dto.address || '',
        p_table_no: dto.tableNo || '',
        p_remark: dto.remark || '',
        p_contact_name: dto.contactName || '',
        p_contact_phone: dto.contactPhone || '',
        p_items: itemsJsonb,
        p_order_date: orderDate,
      });
      if (rpcErr) {
        throw new BadRequestException(`创建订单失败: ${rpcErr.message}`);
      }
    } else {
      memoryOrders.set(orderId, order);
    }

    // Send WebSocket event
    try {
      this.orderGateway.emitOrderCreated(order);
    } catch (e) {
      // WebSocket not initialized
    }

    return order;
  }

  async findById(id: string): Promise<OrderRecord> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_orders')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) throw new NotFoundException(`订单 ${id} 不存在`);
      const order = this.toRecord(data);
      order.items = await this.fetchItems(id);
      return order;
    }

    const order = memoryOrders.get(id);
    if (!order) throw new NotFoundException(`订单 ${id} 不存在`);
    return order;
  }

  async findByUserId(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedData<OrderRecord>> {
    if (hasSupabase() && supabase) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from('tf_orders')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw new BadRequestException(`查询订单失败: ${error.message}`);

      const orders = (data || []).map((row) => {
        const order = this.toRecord(row);
        return order;
      });
      
      // 批量获取订单项
      const orderIds = orders.map(order => order.id);
      const itemsMap = await this.fetchItemsForOrders(orderIds);
      for (const order of orders) {
        order.items = itemsMap.get(order.id) || [];
      }

      return {
        items: orders,
        total: count || 0,
        page,
        pageSize,
      };
    }

    const userOrders = Array.from(memoryOrders.values())
      .filter((o) => o.userId === userId)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    return this.paginate(userOrders, page, pageSize);
  }

  async findByShopId(
    shopId: string,
    status?: string,
    page = 1,
    pageSize = 20,
    isPool = false,
  ): Promise<PaginatedData<OrderRecord>> {
    if (hasSupabase() && supabase) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from('tf_orders')
        .select('*', { count: 'exact' })
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (isPool) {
        // 抢单池：必须是外送单，且状态在[已接单, 制作中]，且没有骑手
        query = query
          .eq('delivery_type', DeliveryType.DELIVERY)
          .is('rider_id', null)
          .in('status', [OrderStatus.ACCEPTED, OrderStatus.PREPARING]);
      } else if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error, count } = await query;
      if (error) throw new BadRequestException(`查询订单失败: ${error.message}`);

      const orders = (data || []).map((row) => {
        const order = this.toRecord(row);
        return order;
      });
      
      // 批量获取订单项
      const orderIds = orders.map(order => order.id);
      const itemsMap = await this.fetchItemsForOrders(orderIds);
      for (const order of orders) {
        order.items = itemsMap.get(order.id) || [];
      }

      return {
        items: orders,
        total: count || 0,
        page,
        pageSize,
      };
    }

    let filtered = Array.from(memoryOrders.values())
      .filter((o) => o.shopId === shopId)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    if (isPool) {
      filtered = filtered.filter(o => 
        o.deliveryType === DeliveryType.DELIVERY && 
        !o.riderId && 
        [OrderStatus.ACCEPTED, OrderStatus.PREPARING].includes(o.status)
      );
    } else if (status) {
      filtered = filtered.filter((o) => o.status === status);
    }
    return this.paginate(filtered, page, pageSize);
  }

  async findByRiderId(
    riderId: string,
    status?: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedData<OrderRecord>> {
    if (hasSupabase() && supabase) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from('tf_orders')
        .select('*', { count: 'exact' })
        .eq('rider_id', riderId)
        .order('updated_at', { ascending: false })
        .range(from, to);
      if (status) {
        query = query.eq('status', status);
      }
      const { data, error, count } = await query;
      if (error) throw new BadRequestException(`查询配送单失败: ${error.message}`);

      const orders = (data || []).map((row) => this.toRecord(row));
      
      // 批量获取订单项
      const orderIds = orders.map(order => order.id);
      const itemsMap = await this.fetchItemsForOrders(orderIds);
      for (const order of orders) {
        order.items = itemsMap.get(order.id) || [];
      }
      
      return { items: orders, total: count || 0, page, pageSize };
    }

    const filtered = Array.from(memoryOrders.values())
      .filter((o) => o.riderId === riderId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return this.paginate(status ? filtered.filter(o => o.status === status) : filtered, page, pageSize);
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderDto,
  ): Promise<OrderRecord> {
    if (hasSupabase() && supabase) {
      // Get current order
      const { data: rowData, error: fetchErr } = await supabase
        .from('tf_orders')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr || !rowData) throw new NotFoundException(`订单 ${id} 不存在`);
      const order = this.toRecord(rowData);
      order.items = await this.fetchItems(id);

      if (dto.status) {
        this.validateStatusTransition(order.status, dto.status);
        const previousStatus = order.status;
        const { error: updateErr } = await supabase
          .from('tf_orders')
          .update({ status: dto.status, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (updateErr) throw new BadRequestException(`更新订单状态失败: ${updateErr.message}`);

        // Update daily stats atomically on status transitions
        await this.updateDailyStatsOnStatusChange(order.shopId, id, previousStatus, dto.status!);

        try {
          this.orderGateway.emitOrderUpdated(order, previousStatus);
        } catch (e) { console.warn(e instanceof Error ? e.message : String(e)); }

        order.status = dto.status;
        order.updatedAt = new Date().toISOString();
        return order;
      }

      if (dto.remark !== undefined) {
        await supabase
          .from('tf_orders')
          .update({ remark: dto.remark, updated_at: new Date().toISOString() })
          .eq('id', id);
        order.remark = dto.remark;
        order.updatedAt = new Date().toISOString();
        return order;
      }
    } else {
      const order = memoryOrders.get(id);
      if (!order) throw new NotFoundException(`订单 ${id} 不存在`);

      if (dto.status) {
        this.validateStatusTransition(order.status, dto.status);
        const previousStatus = order.status;
        order.status = dto.status;
        order.updatedAt = new Date().toISOString();
        memoryOrders.set(id, order);

        try {
          this.orderGateway.emitOrderUpdated(order, previousStatus);
        } catch (e) { console.warn(e instanceof Error ? e.message : String(e)); }
        return order;
      }

      if (dto.remark !== undefined) {
        order.remark = dto.remark;
      }
      order.updatedAt = new Date().toISOString();
      memoryOrders.set(id, order);
      return order;
    }

    // Fallback: no status or remark provided, return current order
    if (hasSupabase() && supabase) {
      const { data: rowData } = await supabase
        .from('tf_orders')
        .select('*')
        .eq('id', id)
        .single();
      if (!rowData) throw new NotFoundException(`订单 ${id} 不存在`);
      const order = this.toRecord(rowData);
      order.items = await this.fetchItems(id);
      return order;
    }
    const order = memoryOrders.get(id);
    if (!order) throw new NotFoundException(`订单 ${id} 不存在`);
    return order;
  }

  async cancelOrder(id: string, userId?: string): Promise<OrderRecord> {
    const order = await this.findById(id);
    if (userId && order.userId !== userId) {
      throw new BadRequestException('不能取消他人的订单');
    }
    if (![OrderStatus.PENDING_PAYMENT, OrderStatus.PAID].includes(order.status)) {
      throw new BadRequestException(`订单状态为 ${order.status}，不允许取消`);
    }
    return this.updateStatus(id, {
      status: OrderStatus.CANCELLED,
    });
  }

  async reorder(userId: string, dto: { shopId: string; items: CreateOrderDto['items']; deliveryType: DeliveryType; address?: string; tableNo?: string; remark?: string }): Promise<OrderRecord> {
    const newDto: CreateOrderDto = {
      shopId: dto.shopId,
      userId,
      items: dto.items.map(item => ({
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        specDesc: item.specDesc,
        imageUrl: item.imageUrl,
      })),
      deliveryType: dto.deliveryType,
      address: dto.address,
      tableNo: dto.tableNo,
      remark: dto.remark,
      contactName: '',
      contactPhone: '',
    };
    return this.create(newDto);
  }

  async grabOrder(id: string, riderId: string): Promise<OrderRecord> {
    const order = await this.findById(id);
    if (order.deliveryType !== DeliveryType.DELIVERY) {
      throw new BadRequestException('该订单不是外送订单，无需配送');
    }
    // 支持从 ACCEPTED, PREPARING, DELIVERING 状态抢单
    const grabbableStatuses = [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.DELIVERING];
    if (!grabbableStatuses.includes(order.status)) {
      throw new BadRequestException('当前订单状态不可抢单');
    }
    if (order.riderId) {
      throw new BadRequestException('订单已被抢走');
    }

    const previousStatus = order.status;

    if (hasSupabase() && supabase) {
      // 使用原子操作确保只有一个骑手能成功抢单
      const { data, error } = await supabase
        .from('tf_orders')
        .update({
          rider_id: riderId,
          status: OrderStatus.DELIVERING,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .is('rider_id', null)  // 只有当 rider_id 为空时才更新
        .select()
        .single();
      
      if (error) throw new BadRequestException(`抢单失败: ${error.message}`);
      if (!data) throw new BadRequestException('订单已被抢走');
    } else {
      order.riderId = riderId;
      order.status = OrderStatus.DELIVERING;
      order.updatedAt = new Date().toISOString();
      memoryOrders.set(id, order);
    }

    const updatedOrder = await this.findById(id);
    try {
      this.orderGateway.emitOrderUpdated(updatedOrder, previousStatus);
    } catch (e) { console.warn(e instanceof Error ? e.message : String(e)); }

    return updatedOrder;
  }

  /**
   * 骑手确认送达
   */
  async deliverOrder(id: string, riderId: string): Promise<OrderRecord> {
    const order = await this.findById(id);
    if (order.riderId !== riderId) {
      throw new BadRequestException('非本人订单，无权操作');
    }
    if (order.status !== OrderStatus.DELIVERING) {
      throw new BadRequestException('订单不在配送中');
    }

    return this.updateStatus(id, {
      status: OrderStatus.COMPLETED
    });
  }


  /**
   * 原子更新每日统计数据（订单状态变化时调用）
   */
  private async updateDailyStatsOnStatusChange(
    shopId: string,
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
  ): Promise<void> {
    if (!hasSupabase() || !supabase) return;

    const orderDate = new Date().toISOString().split('T')[0];
    
    // Determine deltas based on status transitions
    let orderDelta = 0;
    let revenueDelta = 0;
    let completedDelta = 0;
    let cancelledDelta = 0;

    // Count new order: PENDING_PAYMENT -> PAID
    if (fromStatus === OrderStatus.PENDING_PAYMENT && toStatus === OrderStatus.PAID) {
      orderDelta = 1;
      // Revenue counted at payment time via payment service
    }
    
    // Count completed: DELIVERING -> COMPLETED or PREPARING -> COMPLETED
    if ([OrderStatus.DELIVERING, OrderStatus.PREPARING].includes(fromStatus) && toStatus === OrderStatus.COMPLETED) {
      completedDelta = 1;
      // Get order total for revenue
      try {
        const { data: orderData } = await supabase!
          .from('tf_orders')
          .select('total')
          .eq('id', orderId)
          .single();
        if (orderData) {
          revenueDelta = orderData.total;
        }
      } catch (e) { console.warn(e instanceof Error ? e.message : String(e)); }
    }

    // Count cancelled: PENDING_PAYMENT -> CANCELLED or PAID -> CANCELLED
    if (toStatus === OrderStatus.CANCELLED) {
      cancelledDelta = 1;
      if (fromStatus === OrderStatus.PAID) {
        // Revenue was already counted, need to reverse it
        try {
          const { data: orderData } = await supabase!
            .from('tf_orders')
            .select('total')
            .eq('id', orderId)
            .single();
          if (orderData) {
            revenueDelta = -(orderData.total || 0);
          }
        } catch (e) { console.warn(e instanceof Error ? e.message : String(e)); }
      }
    }

    if (orderDelta !== 0 || revenueDelta !== 0 || completedDelta !== 0 || cancelledDelta !== 0) {
      const { error: statsErr } = await supabase.rpc('atomic_update_daily_stats', {
        p_shop_id: shopId,
        p_stat_date: orderDate,
        p_order_delta: orderDelta,
        p_revenue_delta: revenueDelta,
        p_completed_delta: completedDelta,
        p_cancelled_delta: cancelledDelta,
      });
      if (statsErr) {
        console.warn('日统计原子更新失败:', statsErr.message);
      }
    }
  }

  async getTodayStats(shopId: string): Promise<OrderStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_orders')
        .select('status, total, created_at')
        .eq('shop_id', shopId)
        .gte('created_at', todayStart);
      if (error) {
        console.error('[OrderService] getTodayStats error:', error.message);
        return { totalOrders: 0, totalRevenue: 0, pendingCount: 0, preparingCount: 0, completedCount: 0 };
      }
      const todayOrders = (data || []) as OrderRow[];
      const stats: OrderStats = {
        totalOrders: todayOrders.length,
        totalRevenue: todayOrders
          .filter((o) =>
            [OrderStatus.COMPLETED, OrderStatus.DELIVERING, OrderStatus.PREPARING].includes(o.status as OrderStatus),
          )
          .reduce((sum: number, o) => sum + o.total, 0),
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

    const todayOrders = Array.from(memoryOrders.values()).filter(
      (o) => o.shopId === shopId && new Date(o.createdAt).getTime() >= today.getTime(),
    );

    return {
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
  }

  private validateStatusTransition(current: OrderStatus, next: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
      [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.DELIVERING],
      [OrderStatus.PREPARING]: [OrderStatus.DELIVERING, OrderStatus.READY_FOR_PICKUP, OrderStatus.COMPLETED],
      [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.COMPLETED],
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

  private paginate<T>(items: T[], page: number, pageSize: number): PaginatedData<T> {
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    return { items: paged, total: items.length, page, pageSize };
  }
}
