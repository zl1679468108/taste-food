import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus, DeliveryType, PromotionType, ShopStatus } from '../../common/constants/enums';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderGateway } from './order.gateway';
import { PromotionService } from '../promotion/promotion.service';
import { ShopService } from '../shop/shop.service';
import { MenuService } from '../menu/menu.service';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import { DeliveryTrackPointDto } from './dto/delivery-track.dto';

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
  invoiceNeeded?: boolean;
  invoiceTitle?: string;
  invoiceTaxNo?: string;
  items: OrderItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryTrackPointRecord {
  id: string;
  orderId: string;
  shopId: string;
  riderId?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  accuracy?: number;
  source: string;
  recordedAt: string;
  createdAt: string;
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
  invoice_needed?: boolean;
  invoice_title?: string;
  invoice_tax_no?: string;
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

interface DeliveryTrackPointRow {
  id: string;
  order_id: string;
  shop_id: string;
  rider_id?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  accuracy?: number;
  source?: string;
  recorded_at: string;
  created_at: string;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingCount: number;
  preparingCount: number;
  completedCount: number;
}

export interface DailyStatsItem {
  date: string; // YYYY-MM-DD
  orders: number;
  revenue: number;
}

export interface StatusDistributionItem {
  status: string;
  count: number;
}

// Memory fallback storage
const memoryOrders: Map<string, OrderRecord> = new Map();
const memoryDeliveryTracks: Map<string, DeliveryTrackPointRecord[]> = new Map();
// 旧库无 rider_id 列时，用内存记录抢单归属（进程内有效）
const memoryRiderClaims: Map<string, string> = new Map();

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @Inject(forwardRef(() => OrderGateway))
    private readonly orderGateway: OrderGateway,
    private readonly promotionService: PromotionService,
    private readonly shopService: ShopService,
    private readonly menuService: MenuService,
  ) {}

  private isMissingColumnError(error: { message?: string } | null | undefined): boolean {
    const msg = String(error?.message || '').toLowerCase();
    // 兼容 PostgREST schema cache 与 Postgres 缺列错误文案
    return (
      (msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache'))) ||
      (msg.includes('could not find the') && msg.includes('column'))
    );
  }

  private isMissingRpcError(error: { message?: string; code?: string } | null | undefined): boolean {
    const msg = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return (
      msg.includes('could not find the function') ||
      (msg.includes('function') && msg.includes('schema cache')) ||
      msg.includes('pgrst202') ||
      code === 'pgrst202' ||
      code === '42883'
    );
  }

  private async updateOrderStatusDirect(
    id: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    extra: Record<string, unknown> = {},
  ): Promise<OrderRecord> {
    if (!supabase) {
      throw new BadRequestException('更新订单状态失败: Supabase 不可用');
    }
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      status: toStatus,
      updated_at: now,
      ...extra,
    };

    let { data, error } = await supabase
      .from('tf_orders')
      .update(payload)
      .eq('id', id)
      .eq('status', fromStatus)
      .select('*')
      .maybeSingle();

    if (error && this.isMissingColumnError(error)) {
      const minimal = { status: toStatus, updated_at: now };
      ({ data, error } = await supabase
        .from('tf_orders')
        .update(minimal)
        .eq('id', id)
        .eq('status', fromStatus)
        .select('*')
        .maybeSingle());
    }

    if (error) {
      throw new BadRequestException(`更新订单状态失败: ${error.message}`);
    }
    if (!data) {
      throw new BadRequestException(
        `更新订单状态失败: 状态已变更或不存在 (期望 ${fromStatus} → ${toStatus})`,
      );
    }

    const order = this.toRecord(data);
    order.items = await this.fetchItems(id);
    return order;
  }

  private async createOrderLegacyFallback(params: {
    orderId: string;
    dto: CreateOrderDto;
    total: number;
    deliveryFee: number;
    items: OrderItemRecord[];
    now: string;
  }): Promise<void> {
    if (!supabase) {
      throw new BadRequestException('创建订单失败: Supabase 不可用');
    }
    const { orderId, dto, total, deliveryFee, items, now } = params;

    const orderPayloadCandidates: Record<string, unknown>[] = [
      // 旧线上库优先：仅已确认存在的列
      {
        id: orderId,
        shop_id: dto.shopId,
        user_id: dto.userId || '',
        status: OrderStatus.PENDING_PAYMENT,
        total,
        delivery_type: dto.deliveryType,
        address: dto.address || '',
        table_no: dto.tableNo || '',
        remark: dto.remark || '',
        contact_name: dto.contactName || '',
        contact_phone: dto.contactPhone || '',
        created_at: now,
        updated_at: now,
      },
      {
        id: orderId,
        shop_id: dto.shopId,
        user_id: dto.userId || '',
        status: OrderStatus.PENDING_PAYMENT,
        total,
        delivery_fee: deliveryFee,
        delivery_type: dto.deliveryType,
        address: dto.address || '',
        table_no: dto.tableNo || '',
        remark: dto.remark || '',
        contact_name: dto.contactName || '',
        contact_phone: dto.contactPhone || '',
        created_at: now,
        updated_at: now,
      },
      {
        id: orderId,
        shop_id: dto.shopId,
        user_id: dto.userId || '',
        status: OrderStatus.PENDING_PAYMENT,
        total,
        delivery_fee: deliveryFee,
        delivery_type: dto.deliveryType,
        address: dto.address || '',
        table_no: dto.tableNo || '',
        remark: dto.remark || '',
        contact_name: dto.contactName || '',
        contact_phone: dto.contactPhone || '',
        invoice_needed: !!dto.invoiceNeeded,
        invoice_title: dto.invoiceNeeded ? (dto.invoiceTitle || null) : null,
        invoice_tax_no: dto.invoiceNeeded ? (dto.invoiceTaxNo || null) : null,
        created_at: now,
        updated_at: now,
      },
    ];

    let inserted = false;
    let lastError: { message?: string } | null = null;
    for (const payload of orderPayloadCandidates) {
      const { error } = await supabase.from('tf_orders').insert(payload);
      if (!error) {
        inserted = true;
        break;
      }
      lastError = error;
      if (!this.isMissingColumnError(error)) {
        throw new BadRequestException('创建订单失败: ' + (error.message || '未知错误'));
      }
    }
    if (!inserted) {
      throw new BadRequestException('创建订单失败: ' + ((lastError && lastError.message) || '未知错误'));
    }

    const itemRows = items.map((item) => ({
      id: item.id,
      order_id: orderId,
      menu_item_id: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      spec_desc: item.specDesc || '',
      image_url: item.imageUrl || '',
    }));
    const { error: itemErr } = await supabase.from('tf_order_items').insert(itemRows);
    if (itemErr) {
      await supabase.from('tf_orders').delete().eq('id', orderId);
      throw new BadRequestException('创建订单明细失败: ' + itemErr.message);
    }
  }

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
      invoiceNeeded: !!row.invoice_needed,
      invoiceTitle: row.invoice_title || undefined,
      invoiceTaxNo: row.invoice_tax_no || undefined,
      items: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async fetchItems(orderId: string): Promise<OrderItemRecord[]> {
    if (!hasSupabase() || !supabase) {
      assertMemoryFallbackAllowed('OrderService');
      return [];
    }
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
    if (!hasSupabase() || !supabase) {
      assertMemoryFallbackAllowed('OrderService');
      return new Map();
    }
    if (orderIds.length === 0) return new Map();
    
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

  private toDeliveryTrackPoint(row: DeliveryTrackPointRow): DeliveryTrackPointRecord {
    return {
      id: row.id,
      orderId: row.order_id,
      shopId: row.shop_id,
      riderId: row.rider_id || undefined,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      speed: row.speed === undefined || row.speed === null ? undefined : Number(row.speed),
      accuracy: row.accuracy === undefined || row.accuracy === null ? undefined : Number(row.accuracy),
      source: row.source || 'rider',
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
    };
  }

  async create(dto: CreateOrderDto): Promise<OrderRecord> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('订单必须包含至少一个菜品');
    }

    // 空 contactPhone 规范为 undefined，避免空串落库/触发校验副作用
    if (dto.contactPhone !== undefined && dto.contactPhone !== null && String(dto.contactPhone).trim() === '') {
      dto.contactPhone = undefined;
    }

    // 堂食必须有桌号，外送必须有地址
    if (dto.deliveryType === DeliveryType.DINE_IN && !dto.tableNo) {
      throw new BadRequestException('堂食订单必须选择桌号');
    }
    if (dto.deliveryType === DeliveryType.DELIVERY && !dto.address) {
      throw new BadRequestException('外送订单必须提供配送地址');
    }

    // P1-6 关店/非营业禁下单
    let shopForOrder: Awaited<ReturnType<ShopService['findById']>>;
    try {
      shopForOrder = await this.shopService.findById(dto.shopId);
    } catch {
      throw new BadRequestException(`店铺 ${dto.shopId} 不存在或查询失败`);
    }
    const shopClosed =
      typeof (shopForOrder as { isOpenNow?: boolean }).isOpenNow === 'boolean'
        ? !(shopForOrder as { isOpenNow?: boolean }).isOpenNow
        : shopForOrder.status !== ShopStatus.OPEN;
    if (shopClosed) {
      throw new BadRequestException('店铺休息中，暂不可下单');
    }

    const now = new Date().toISOString();
    const orderId = uuidv4();

    // 服务端校验菜品价格：base price + 规格加价（分），不信任客户端传入的 price
    const verifiedItems: { menuItemId: string; name: string; quantity: number; price: number; specDesc: string; imageUrl: string }[] = [];
    for (const item of dto.items) {
      try {
        const menuItem = await this.menuService.getMenuItemById(item.menuItemId);
        let unitPrice = menuItem.price; // 基础价（分）

        // 有 specOptionIds 时按 option.priceAdjust 累加核价；无则兼容旧客户端仅用 base price
        if (item.specOptionIds && item.specOptionIds.length > 0) {
          const uniqueOptionIds = Array.from(new Set(item.specOptionIds));
          const specGroups = await this.menuService.getMenuItemSpecs(item.menuItemId);
          const optionMap = new Map<string, number>();
          for (const group of specGroups) {
            for (const option of group.options || []) {
              optionMap.set(option.id, option.priceAdjust || 0);
            }
          }

          let priceAdjustTotal = 0;
          for (const optionId of uniqueOptionIds) {
            if (!optionMap.has(optionId)) {
              throw new BadRequestException(
                `菜品 ${menuItem.name} 不包含规格选项 ${optionId}`,
              );
            }
            priceAdjustTotal += optionMap.get(optionId) || 0;
          }
          unitPrice = menuItem.price + priceAdjustTotal;
        }

        verifiedItems.push({
          menuItemId: item.menuItemId,
          name: menuItem.name,
          quantity: item.quantity,
          price: unitPrice, // verifiedItems.price = base + sum(priceAdjust)
          specDesc: item.specDesc || '',
          imageUrl: menuItem.imageUrl || item.imageUrl || '',
        });
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        throw new BadRequestException(`菜品 ${item.name || item.menuItemId} 不存在或已下架`);
      }
    }

    // 配送费从店铺配置获取，不信任客户端传值（复用上方已查询的 shopForOrder）
    let deliveryFee = 0;
    if (dto.deliveryType === DeliveryType.DELIVERY) {
      deliveryFee = shopForOrder.deliveryFee || 0;
      const itemsTotalForMin = verifiedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (shopForOrder.minOrderAmount && itemsTotalForMin < shopForOrder.minOrderAmount) {
        throw new BadRequestException(
          `订单金额 ${itemsTotalForMin} 分未达到起送价 ${shopForOrder.minOrderAmount} 分`,
        );
      }
    }

    const itemsTotal = verifiedItems.reduce(
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
      this.logger.warn(`优惠计算失败: ${e instanceof Error ? e.message : e}`);
    }

    const total = Math.max(0, itemsTotal + deliveryFee - discountAmount);

    const items: OrderItemRecord[] = verifiedItems.map((item) => ({
      id: uuidv4(),
      orderId,
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      specDesc: item.specDesc,
      imageUrl: item.imageUrl,
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
      invoiceNeeded: !!dto.invoiceNeeded,
      invoiceTitle: dto.invoiceNeeded ? (dto.invoiceTitle || undefined) : undefined,
      invoiceTaxNo: dto.invoiceNeeded ? (dto.invoiceTaxNo || undefined) : undefined,
      items,
      createdAt: now,
      updatedAt: now,
    };

    if (hasSupabase() && supabase) {
      // 优先走原子 RPC；旧库函数/字段缺失时降级为分步写入，保证主流程可上线
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
        p_invoice_needed: !!dto.invoiceNeeded,
        p_invoice_title: dto.invoiceNeeded ? (dto.invoiceTitle || null) : null,
        p_invoice_tax_no: dto.invoiceNeeded ? (dto.invoiceTaxNo || null) : null,
      });

      if (rpcErr) {
        const msg = rpcErr.message || '';
        const canFallback =
          /p_invoice_|invoice_needed|invoice_title|invoice_tax_no|Could not find the function|delivery_fee|column|does not exist|PGRST202|42883/i.test(
            msg,
          );
        if (!canFallback) {
          throw new BadRequestException(`创建订单失败: ${msg}`);
        }

        this.logger.warn(`[Order] atomic_create_order 不可用，降级分步创建: ${msg}`);

        // 函数整体缺失时直接走表写入；仅在可能是参数签名差异时再重试旧 RPC
        const functionMissing = /could not find the function|schema cache/i.test(msg);
        if (functionMissing) {
          await this.createOrderLegacyFallback({
            orderId,
            dto,
            total,
            deliveryFee,
            items,
            now,
          });
        } else {
          const { error: retryErr } = await supabase.rpc('atomic_create_order', {
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

          if (retryErr) {
            await this.createOrderLegacyFallback({
              orderId,
              dto,
              total,
              deliveryFee,
              items,
              now,
            });
          } else if (dto.invoiceNeeded) {
            const { error: invErr } = await supabase
              .from('tf_orders')
              .update({
                invoice_needed: true,
                invoice_title: dto.invoiceTitle || null,
                invoice_tax_no: dto.invoiceTaxNo || null,
                updated_at: now,
              })
              .eq('id', orderId);
            if (invErr) {
              this.logger.warn(`[Order] 补写发票字段失败: ${invErr.message}`);
            }
          }
        }
      }
    } else {
      assertMemoryFallbackAllowed('OrderService');
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

    assertMemoryFallbackAllowed('OrderService');
    const order = memoryOrders.get(id);
    if (!order) throw new NotFoundException(`订单 ${id} 不存在`);
    return order;
  }

  async listDeliveryTrack(orderId: string): Promise<DeliveryTrackPointRecord[]> {
    const order = await this.findById(orderId);
    if (order.deliveryType !== DeliveryType.DELIVERY) {
      return [];
    }

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_delivery_tracks')
        .select('*')
        .eq('order_id', orderId)
        .order('recorded_at', { ascending: true });
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('tf_delivery_tracks') || msg.includes('schema cache') || msg.includes('does not exist')) {
          this.logger.warn(`[Order] tf_delivery_tracks 不可用，返回内存轨迹: ${error.message}`);
          return [...(memoryDeliveryTracks.get(orderId) || [])].sort(
            (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
          );
        }
        throw new BadRequestException(`查询配送轨迹失败: ${error.message}`);
      }
      return (data || []).map((row: DeliveryTrackPointRow) => this.toDeliveryTrackPoint(row));
    }

    assertMemoryFallbackAllowed('OrderService');
    return [...(memoryDeliveryTracks.get(orderId) || [])].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
  }

  async appendDeliveryTrackPoint(
    orderId: string,
    riderId: string,
    dto: DeliveryTrackPointDto,
  ): Promise<DeliveryTrackPointRecord> {
    const order = await this.findById(orderId);
    if (order.deliveryType !== DeliveryType.DELIVERY) {
      throw new BadRequestException('非外送订单无需配送轨迹');
    }
    if (order.status !== OrderStatus.DELIVERING) {
      throw new BadRequestException('订单不在配送中，暂不能上报位置');
    }
    if (order.riderId && order.riderId !== riderId) {
      throw new BadRequestException('非本人配送订单，无权上报位置');
    }

    const now = new Date().toISOString();
    const point: DeliveryTrackPointRecord = {
      id: uuidv4(),
      orderId,
      shopId: order.shopId,
      riderId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speed: dto.speed,
      accuracy: dto.accuracy,
      source: dto.source || 'rider',
      recordedAt: now,
      createdAt: now,
    };

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_delivery_tracks')
        .insert({
          id: point.id,
          order_id: point.orderId,
          shop_id: point.shopId,
          rider_id: point.riderId,
          latitude: point.latitude,
          longitude: point.longitude,
          speed: point.speed || null,
          accuracy: point.accuracy || null,
          source: point.source,
          recorded_at: point.recordedAt,
          created_at: point.createdAt,
        })
        .select('*')
        .single();
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('tf_delivery_tracks') || msg.includes('schema cache') || msg.includes('does not exist')) {
          this.logger.warn(`[Order] tf_delivery_tracks 不可用，降级内存轨迹: ${error.message}`);
          const list = memoryDeliveryTracks.get(orderId) || [];
          list.push(point);
          memoryDeliveryTracks.set(orderId, list);
          try {
            this.orderGateway.emitDeliveryTrackUpdated({
              orderId: point.orderId,
              shopId: point.shopId,
              userId: order.userId,
              riderId: point.riderId,
              latitude: point.latitude,
              longitude: point.longitude,
              recordedAt: point.recordedAt,
            });
          } catch (e) {
            this.logger.warn(e instanceof Error ? e.message : String(e));
          }
          return point;
        }
        throw new BadRequestException(`上报配送位置失败: ${error.message}`);
      }
      const saved = this.toDeliveryTrackPoint(data as DeliveryTrackPointRow);
      try {
        this.orderGateway.emitDeliveryTrackUpdated({
          orderId: saved.orderId,
          shopId: saved.shopId,
          userId: order.userId,
          riderId: saved.riderId,
          latitude: saved.latitude,
          longitude: saved.longitude,
          recordedAt: saved.recordedAt,
        });
      } catch (e) {
        this.logger.warn(e instanceof Error ? e.message : String(e));
      }
      return saved;
    }

    assertMemoryFallbackAllowed('OrderService');
    const existing = memoryDeliveryTracks.get(orderId) || [];
    existing.push(point);
    memoryDeliveryTracks.set(orderId, existing);
    try {
      this.orderGateway.emitDeliveryTrackUpdated({
        orderId: point.orderId,
        shopId: point.shopId,
        userId: order.userId,
        riderId: point.riderId,
        latitude: point.latitude,
        longitude: point.longitude,
        recordedAt: point.recordedAt,
      });
    } catch (e) {
      this.logger.warn(e instanceof Error ? e.message : String(e));
    }
    return point;
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

    assertMemoryFallbackAllowed('OrderService');
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
        // 抢单池：仅 PREPARING 且无骑手的外送单
        // delivering 不在池中（已有骑手或商家自配送 preparing→delivering）
        query = query
          .eq('delivery_type', DeliveryType.DELIVERY)
          .is('rider_id', null)
          .eq('status', OrderStatus.PREPARING);
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

    assertMemoryFallbackAllowed('OrderService');
    let filtered = Array.from(memoryOrders.values())
      .filter((o) => o.shopId === shopId)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    if (isPool) {
      filtered = filtered.filter(o =>
        o.deliveryType === DeliveryType.DELIVERY &&
        !o.riderId &&
        o.status === OrderStatus.PREPARING,
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

    assertMemoryFallbackAllowed('OrderService');
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

        // 优先使用原子 RPC；旧库缺失时降级直更 tf_orders
        const { error: rpcErr } = await supabase.rpc('atomic_update_order_status', {
          p_order_id: id,
          p_from_status: previousStatus,
          p_to_status: dto.status,
        });
        if (rpcErr) {
          if (!this.isMissingRpcError(rpcErr)) {
            throw new BadRequestException(`更新订单状态失败: ${rpcErr.message}`);
          }
          this.logger.warn(
            `[Order] atomic_update_order_status 不可用，降级直更 tf_orders: ${rpcErr.message}`,
          );
          const updated = await this.updateOrderStatusDirect(id, previousStatus, dto.status);
          this.emitStatusEvents(updated, previousStatus);
          return updated;
        }

        order.status = dto.status;
        order.updatedAt = new Date().toISOString();
        this.emitStatusEvents(order, previousStatus);
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

      return order;
    }

    assertMemoryFallbackAllowed('OrderService');
    const order = memoryOrders.get(id);
    if (!order) throw new NotFoundException(`订单 ${id} 不存在`);

    if (dto.status) {
      this.validateStatusTransition(order.status, dto.status);
      const previousStatus = order.status;
      order.status = dto.status;
      order.updatedAt = new Date().toISOString();
      memoryOrders.set(id, order);
      this.emitStatusEvents(order, previousStatus);
      return order;
    }

    if (dto.remark !== undefined) {
      order.remark = dto.remark;
    }
    order.updatedAt = new Date().toISOString();
    memoryOrders.set(id, order);
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

    const previousStatus = order.status;

    if (hasSupabase() && supabase) {
      // 使用原子 RPC 一次完成：状态校验 + 权限校验 + 退款记录更新 + 订单状态更新 + daily_stats 联动
      const { error: rpcErr } = await supabase.rpc('atomic_cancel_order', {
        p_order_id: id,
        p_user_id: userId || null,
      });
      if (rpcErr) {
        if (!this.isMissingRpcError(rpcErr)) {
          throw new BadRequestException(`取消订单失败: ${rpcErr.message}`);
        }
        this.logger.warn(
          `[Order] atomic_cancel_order 不可用，降级直更 tf_orders: ${rpcErr.message}`,
        );
        const updated = await this.updateOrderStatusDirect(
          id,
          previousStatus,
          OrderStatus.CANCELLED,
        );
        try {
          this.orderGateway.emitOrderUpdated(updated, previousStatus);
        } catch (e) {
          this.logger.warn(e instanceof Error ? e.message : String(e));
        }
        return updated;
      }

      order.status = OrderStatus.CANCELLED;
      order.updatedAt = new Date().toISOString();
      try {
        this.orderGateway.emitOrderUpdated(order, previousStatus);
      } catch (e) {
        this.logger.warn(e instanceof Error ? e.message : String(e));
      }
      return order;
    }

    assertMemoryFallbackAllowed('OrderService');
    // 内存模式：已支付订单无支付记录需退款，直接状态更新
    return this.updateStatus(id, { status: OrderStatus.CANCELLED });
  }

  async reorder(userId: string, dto: { shopId: string; items: CreateOrderDto['items']; deliveryType: DeliveryType; address?: string; tableNo?: string; remark?: string; contactName?: string; contactPhone?: string }): Promise<OrderRecord> {
    const newDto: CreateOrderDto = {
      shopId: dto.shopId,
      userId,
      items: dto.items.map(item => ({
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        specDesc: item.specDesc,
        imageUrl: item.imageUrl,
        specOptionIds: item.specOptionIds,
      })),
      deliveryType: dto.deliveryType,
      address: dto.address,
      tableNo: dto.tableNo,
      remark: dto.remark,
      // 从参数复制联系人信息，避免外送订单因无联系方式无法配送
      contactName: dto.contactName || '',
      contactPhone: dto.contactPhone || '',
    };
    return this.create(newDto);
  }

  async grabOrder(id: string, riderId: string): Promise<OrderRecord> {
    const order = await this.findById(id);
    if (order.deliveryType !== DeliveryType.DELIVERY) {
      throw new BadRequestException('该订单不是外送订单，无需配送');
    }
    // 骑手只抢 PREPARING 且无 riderId 的外送单（厨房已开始制作）
    // 商家 preparing → delivering 为「商家自配送」，不进抢单池
    if (order.status !== OrderStatus.PREPARING) {
      throw new BadRequestException('当前订单状态不可抢单');
    }
    if (order.riderId) {
      throw new BadRequestException('订单已被抢走');
    }

    const previousStatus = order.status;

    if (hasSupabase() && supabase) {
      // 使用原子操作确保只有一个骑手能成功抢单
      let { data, error } = await supabase
        .from('tf_orders')
        .update({
          rider_id: riderId,
          status: OrderStatus.DELIVERING,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', OrderStatus.PREPARING)
        .is('rider_id', null)
        .select()
        .maybeSingle();

      // 旧库无 rider_id 时，退化为仅状态流转（无法做骑手归属校验）
      if (error && this.isMissingColumnError(error)) {
        this.logger.warn(`[Order] grabOrder rider_id 列缺失，降级仅更新状态: ${error.message}`);
        ({ data, error } = await supabase
          .from('tf_orders')
          .update({
            status: OrderStatus.DELIVERING,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('status', OrderStatus.PREPARING)
          .select()
          .maybeSingle());
      }

      if (error) throw new BadRequestException(`抢单失败: ${error.message}`);
      if (!data) throw new BadRequestException('订单已被抢走');
    } else {
      assertMemoryFallbackAllowed('OrderService');
      order.riderId = riderId;
      order.status = OrderStatus.DELIVERING;
      order.updatedAt = new Date().toISOString();
      memoryOrders.set(id, order);
    }

    // 无论 DB 是否有 rider_id，都记录进程内归属，便于 deliver 校验
    memoryRiderClaims.set(id, riderId);

    const updatedOrder = await this.findById(id);
    if (!updatedOrder.riderId) {
      updatedOrder.riderId = riderId;
    }
    try {
      this.orderGateway.emitOrderUpdated(updatedOrder, previousStatus);
    } catch (e) { this.logger.warn(e instanceof Error ? e.message : String(e)); }

    return updatedOrder;
  }

  /**
   * 骑手确认送达
   */
  async deliverOrder(id: string, riderId: string): Promise<OrderRecord> {
    const order = await this.findById(id);
    const claimedRiderId = order.riderId || memoryRiderClaims.get(id);
    // 有 rider 归属时校验本人；旧库缺 rider_id 且无内存归属时，允许当前骑手完成（演示兼容）
    if (claimedRiderId && claimedRiderId !== riderId) {
      throw new BadRequestException('非本人订单，无权操作');
    }
    if (order.status !== OrderStatus.DELIVERING) {
      throw new BadRequestException('订单不在配送中');
    }

    const completed = await this.updateStatus(id, {
      status: OrderStatus.COMPLETED,
    });
    memoryRiderClaims.delete(id);
    return completed;
  }


  /**
   * 支付成功后通知商家/顾客（RPC 直更状态时不会走 updateStatus，需显式调用）。
   * 保证推送 order:updated + order:new/order:paid，payload 含 orderId/total/deliveryType/status/itemCount。
   */
  async notifyPaid(orderId: string, previousStatus: OrderStatus = OrderStatus.PENDING_PAYMENT): Promise<OrderRecord> {
    const order = await this.findById(orderId);
    if (order.status !== OrderStatus.PAID) {
      this.logger.warn(
        `[notifyPaid] 订单 ${orderId} 当前状态为 ${order.status}，仍按查询结果推送（期望 paid）`,
      );
    }
    // 若 RPC 已把状态写成 paid，仍按 paid 推送；否则以查询结果为准
    this.emitStatusEvents(order, previousStatus);
    return order;
  }

  /** 状态变更统一推送：updated + paid 时额外 order:new/order:paid */
  private emitStatusEvents(order: OrderRecord, previousStatus: OrderStatus | string): void {
    try {
      this.orderGateway.emitOrderUpdated(order, String(previousStatus));
      if (order.status === OrderStatus.PAID) {
        this.orderGateway.emitOrderNew(order, String(previousStatus));
      }
    } catch (e) {
      this.logger.warn(
        `[emitStatusEvents] 推送失败 orderId=${order.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * 原子更新每日统计数据（订单状态变化时调用）
   *
   * 注意：此方法已废弃，daily_stats 更新逻辑已迁移到 atomic_update_order_status RPC 内部，
   * 由 RPC 在同一事务中完成订单状态 + daily_stats 联动，避免应用层多步操作导致不一致。
   * 保留方法仅供内存回退模式使用（生产环境依赖 Supabase RPC）。
   */
  private async updateDailyStatsOnStatusChange(
    shopId: string,
    orderId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
  ): Promise<void> {
    if (!hasSupabase() || !supabase) return;

    const orderDate = new Date().toISOString().split('T')[0];

    let orderDelta = 0;
    let revenueDelta = 0;
    let completedDelta = 0;
    let cancelledDelta = 0;

    if (fromStatus === OrderStatus.PENDING_PAYMENT && toStatus === OrderStatus.PAID) {
      orderDelta = 1;
    }

    // 仅 DELIVERING/READY_FOR_PICKUP -> COMPLETED 计入完成数（与 PRD 状态流转一致）
    if (
      [OrderStatus.DELIVERING, OrderStatus.READY_FOR_PICKUP].includes(fromStatus) &&
      toStatus === OrderStatus.COMPLETED
    ) {
      completedDelta = 1;
      try {
        const { data: orderData } = await supabase
          .from('tf_orders')
          .select('total')
          .eq('id', orderId)
          .single();
        if (orderData) {
          revenueDelta = orderData.total;
        }
      } catch (e) { this.logger.warn(e instanceof Error ? e.message : String(e)); }
    }

    if (toStatus === OrderStatus.CANCELLED) {
      cancelledDelta = 1;
      if (fromStatus === OrderStatus.PAID) {
        try {
          const { data: orderData } = await supabase
            .from('tf_orders')
            .select('total')
            .eq('id', orderId)
            .single();
          if (orderData) {
            revenueDelta = -(orderData.total || 0);
          }
        } catch (e) { this.logger.warn(e instanceof Error ? e.message : String(e)); }
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
        this.logger.warn('日统计原子更新失败:', statsErr.message);
      }
    }
  }


  /**
   * 导出店铺订单为 CSV 文本（最多 maxRows 条，按创建时间倒序）。
   * 金额列为「元」两位小数，便于 Excel。
   */
  async exportOrdersCsv(
    shopId: string,
    opts?: { status?: string; maxRows?: number },
  ): Promise<{ csv: string; count: number; filename: string }> {
    const maxRows = Math.min(Math.max(opts?.maxRows || 1000, 1), 5000);
    const pageSize = Math.min(maxRows, 100);
    let page = 1;
    const all: OrderRecord[] = [];
    while (all.length < maxRows) {
      const batch = await this.findByShopId(shopId, opts?.status, page, pageSize, false);
      all.push(...batch.items);
      if (batch.items.length === 0 || all.length >= batch.total || batch.items.length < pageSize) {
        break;
      }
      page += 1;
    }
    const rows = all.slice(0, maxRows);
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const fenToYuan = (fen: number) => ((Number(fen) || 0) / 100).toFixed(2);
    const header = [
      '订单号',
      '短单号',
      '状态',
      '配送类型',
      '金额(元)',
      '配送费(元)',
      '桌号',
      '地址',
      '联系人',
      '电话',
      '备注',
      '需要发票',
      '发票抬头',
      '税号',
      '商品摘要',
      '创建时间',
      '更新时间',
    ];
    const lines = [header.join(',')];
    for (const o of rows) {
      const itemsSummary = (o.items || [])
        .map((it) => `${it.name}x${it.quantity}`)
        .join('；');
      lines.push(
        [
          o.id,
          (o.id || '').slice(0, 8),
          o.status,
          o.deliveryType,
          fenToYuan(o.total),
          fenToYuan(o.deliveryFee),
          o.tableNo || '',
          o.address || '',
          o.contactName || '',
          o.contactPhone || '',
          o.remark || '',
          o.invoiceNeeded ? '是' : '否',
          o.invoiceTitle || '',
          o.invoiceTaxNo || '',
          itemsSummary,
          o.createdAt,
          o.updatedAt,
        ]
          .map(escape)
          .join(','),
      );
    }
    const day = new Date().toISOString().slice(0, 10);
    const statusPart = opts?.status ? `_${opts.status}` : '';
    return {
      csv: '\uFEFF' + lines.join('\n'),
      count: rows.length,
      filename: `orders${statusPart}_${day}.csv`,
    };
  }

  async getTodayStats(shopId: string): Promise<OrderStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    const todayDate = todayStart.split('T')[0];

    if (hasSupabase() && supabase) {
      // 优先查询 tf_daily_stats 预聚合表（单行索引查询），避免全量订单加载到内存计算
      const { data: statsRow, error: statsErr } = await supabase
        .from('tf_daily_stats')
        .select('total_orders, completed_orders')
        .eq('shop_id', shopId)
        .eq('stat_date', todayDate)
        .maybeSingle();
      const hasDailyStats = !statsErr && statsRow;

      // 轻量查询：仅选取 status/total 列计算 revenue/pending/preparing
      // （口径与 daily_stats 不同：revenue 含 DELIVERING/PREPARING，daily_stats 仅含 COMPLETED）
      const { data, error } = await supabase
        .from('tf_orders')
        .select('status, total')
        .eq('shop_id', shopId)
        .gte('created_at', todayStart);
      if (error) {
        this.logger.error('[OrderService] getTodayStats error:', error.message);
        return { totalOrders: 0, totalRevenue: 0, pendingCount: 0, preparingCount: 0, completedCount: 0 };
      }
      const todayOrders = (data || []) as Pick<OrderRow, 'status' | 'total'>[];
      const revenueStatuses: OrderStatus[] = [
        OrderStatus.COMPLETED,
        OrderStatus.DELIVERING,
        OrderStatus.PREPARING,
      ];

      return {
        // daily_stats 有今日数据时使用预聚合值，否则回退到内存计数
        totalOrders: hasDailyStats ? (statsRow!.total_orders || 0) : todayOrders.length,
        totalRevenue: todayOrders
          .filter((o) => revenueStatuses.includes(o.status as OrderStatus))
          .reduce((sum, o) => sum + o.total, 0),
        pendingCount: todayOrders.filter(
          (o) => o.status === OrderStatus.PAID || o.status === OrderStatus.ACCEPTED,
        ).length,
        preparingCount: todayOrders.filter(
          (o) => o.status === OrderStatus.PREPARING,
        ).length,
        completedCount: hasDailyStats
          ? (statsRow!.completed_orders || 0)
          : todayOrders.filter((o) => o.status === OrderStatus.COMPLETED).length,
      };
    }

    assertMemoryFallbackAllowed('OrderService');
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

  /**
   * 按天聚合订单统计（用于 Dashboard 近 N 天趋势图）
   * 收入按 [completed, delivering, preparing] 状态计算（与 getTodayStats 口径一致）
   */
  async getDailyStats(shopId: string, days = 7): Promise<DailyStatsItem[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const startIso = start.toISOString();

    // 初始化日期桶（保证连续日期，无订单的日期为 0）
    const buckets: DailyStatsItem[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      buckets.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        orders: 0,
        revenue: 0,
      });
    }
    const bucketMap = new Map(buckets.map((b) => [b.date, b]));

    const revenueStatuses: OrderStatus[] = [
      OrderStatus.COMPLETED,
      OrderStatus.DELIVERING,
      OrderStatus.PREPARING,
    ];

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_orders')
        .select('status, total, created_at')
        .eq('shop_id', shopId)
        .gte('created_at', startIso);
      if (error) {
        this.logger.warn(`[OrderService] getDailyStats error: ${error.message}`);
        return buckets;
      }
      for (const row of (data || []) as OrderRow[]) {
        const d = new Date(row.created_at);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const bucket = bucketMap.get(dateStr);
        if (!bucket) continue; // 超出窗口的订单忽略
        bucket.orders += 1;
        if (revenueStatuses.includes(row.status as OrderStatus)) {
          bucket.revenue += row.total || 0;
        }
      }
      return buckets;
    }

    assertMemoryFallbackAllowed('OrderService');
    const filtered = Array.from(memoryOrders.values()).filter(
      (o) => o.shopId === shopId && new Date(o.createdAt).getTime() >= start.getTime(),
    );
    for (const o of filtered) {
      const d = new Date(o.createdAt);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const bucket = bucketMap.get(dateStr);
      if (!bucket) continue;
      bucket.orders += 1;
      if (revenueStatuses.includes(o.status)) {
        bucket.revenue += o.total;
      }
    }
    return buckets;
  }

  /**
   * 全店铺订单状态分布（用于 Dashboard 饼图）
   */
  async getStatusDistribution(shopId: string): Promise<StatusDistributionItem[]> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_orders')
        .select('status')
        .eq('shop_id', shopId);
      if (error) {
        this.logger.warn(`[OrderService] getStatusDistribution error: ${error.message}`);
        return [];
      }
      const map: Record<string, number> = {};
      for (const row of (data || []) as OrderRow[]) {
        map[row.status] = (map[row.status] || 0) + 1;
      }
      return Object.entries(map).map(([status, count]) => ({ status, count }));
    }

    assertMemoryFallbackAllowed('OrderService');
    const filtered = Array.from(memoryOrders.values()).filter((o) => o.shopId === shopId);
    const map: Record<string, number> = {};
    for (const o of filtered) {
      map[o.status] = (map[o.status] || 0) + 1;
    }
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }

  private validateStatusTransition(current: OrderStatus, next: OrderStatus): void {
    // 状态流转规范（与 PRD §5.2 一致）：
    // 外送: pending_payment → paid → accepted → preparing → delivering → completed
    // 自取/堂食: pending_payment → paid → accepted → preparing → ready_for_pickup → completed
    // 分支: → cancelled（pending_payment/paid 时）、→ rejected（paid 时）
    // 注意：preparing 不能直接 → completed；
    // - 外送必须经 delivering
    // - 堂食/自取必须经 ready_for_pickup，禁止 preparing → completed
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
      [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING],
      [OrderStatus.PREPARING]: [OrderStatus.DELIVERING, OrderStatus.READY_FOR_PICKUP],
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
