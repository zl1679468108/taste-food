import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as ExcelJS from 'exceljs';
import { OrderStatus, DeliveryType, PromotionType, ShopStatus } from '../../common/constants/enums';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderGateway } from './order.gateway';
import { PromotionService } from '../promotion/promotion.service';
import { ShopService } from '../shop/shop.service';
import { AddressService } from '../address/address.service';
import { MenuService } from '../menu/menu.service';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import { DeliveryTrackPointDto } from './dto/delivery-track.dto';
import {
  normalizeGeoPoint,
  resolveGeoPoint,
} from '../../common/utils/tencent-map';

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
  /** 业务订单号，如 TF20260726A0010007；旧单可能缺失 */
  orderNo?: string;
  shopId: string;
  userId: string;
  riderId?: string; // 增加骑手 ID
  status: OrderStatus;
  total: number;
  deliveryFee: number;
  deliveryType: DeliveryType;
  address?: string;
  shopLatitude?: number;
  shopLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  tableNo?: string;
  remark?: string;
  cancelReason?: string;
  rejectReason?: string;
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
  order_no?: string;
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
  cancel_reason?: string;
  reject_reason?: string;
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
/** 店铺日序号（内存）：key = shopId:YYYYMMDD */
const memoryOrderSeq: Map<string, number> = new Map();

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  accepted: '已接单',
  preparing: '制作中',
  ready_for_pickup: '待取餐',
  delivering: '配送中',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已拒单',
};

const DELIVERY_TYPE_LABEL: Record<string, string> = {
  delivery: '外卖配送',
  pickup: '到店自取',
  dine_in: '堂食',
};

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @Inject(forwardRef(() => OrderGateway))
    private readonly orderGateway: OrderGateway,
    private readonly promotionService: PromotionService,
    private readonly shopService: ShopService,
    private readonly menuService: MenuService,
    private readonly addressService: AddressService,
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

  /** 配送类型码：D=外卖 P=自取 I=堂食 */
  private deliveryTypeCode(deliveryType: string): string {
    const map: Record<string, string> = {
      delivery: 'D',
      pickup: 'P',
      dine_in: 'I',
    };
    return map[deliveryType] ?? 'X';
  }

  /** 店铺序号：从 tf_shops 按 created_at 排序取序号，格式2位；内存兜底用 UUID 末2位 */
  private async shopSeqNo(shopId: string): Promise<string> {
    if (hasSupabase() && supabase) {
      try {
        const { data } = await supabase
          .from('tf_shops')
          .select('id')
          .order('created_at', { ascending: true });
        if (data && data.length > 0) {
          const idx = data.findIndex((s) => s.id === shopId);
          const seq = idx >= 0 ? idx + 1 : data.length + 1;
          return String(seq).padStart(2, '0');
        }
      } catch (e) {
        this.logger.warn(`[Order] 获取店铺序号失败: ${e instanceof Error ? e.message : e}`);
      }
    }
    // 内存兜底：取 shopId 末2位数字字符
    const digits = String(shopId || '').replace(/\D/g, '');
    return (digits.slice(-2) || '01').padStart(2, '0');
  }

  private formatOrderDateKey(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  /** 生成订单号：TF + YYYYMMDD + 配送类型码(D/P/I) + 店铺序号2位 + 当日流水4位 */
  private buildOrderNo(deliveryCode: string, shopSeq: string, dateKey: string, seq: number): string {
    return `TF${dateKey}${deliveryCode}${shopSeq}${String(seq).padStart(4, '0')}`;
  }

  /** 旧单无 order_no 时的兼容展示（基于 uuid 前 8 位） */
  private compatOrderNo(orderId: string): string {
    return String(orderId || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  /**
   * 生成业务订单号：TF + YYYYMMDD + 配送类型码(D/P/I) + 店铺序号2位 + 当日流水4位
   * 例：TF20260726D010001（2026-07-26 外卖 第1家店 第1单）
   */
  private async allocateOrderNo(shopId: string, deliveryType: string): Promise<string> {
    const dateKey = this.formatOrderDateKey();
    const deliveryCode = this.deliveryTypeCode(deliveryType);
    const shopSeq = await this.shopSeqNo(shopId);
    const seqKey = `${shopId}:${dateKey}:${deliveryType}`;
    let seq = 1;

    if (hasSupabase() && supabase) {
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const { count, error } = await supabase
          .from('tf_orders')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .eq('delivery_type', deliveryType)
          .gte('created_at', start.toISOString());
        if (!error) {
          seq = (count || 0) + 1;
        }
      } catch (e) {
        this.logger.warn(
          `[Order] 统计当日订单序号失败: ${e instanceof Error ? e.message : e}`,
        );
      }
    } else {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const startMs = start.getTime();
      const todayCount = Array.from(memoryOrders.values()).filter(
        (o) => o.shopId === shopId && o.deliveryType === deliveryType && new Date(o.createdAt).getTime() >= startMs,
      ).length;
      seq = todayCount + 1;
    }

    const mem = memoryOrderSeq.get(seqKey) || 0;
    seq = Math.max(seq, mem + 1);
    memoryOrderSeq.set(seqKey, seq);
    return this.buildOrderNo(deliveryCode, shopSeq, dateKey, seq);
  }

  private async persistOrderNo(orderId: string, orderNo: string): Promise<void> {
    if (!hasSupabase() || !supabase || !orderNo) return;
    try {
      const { error } = await supabase
        .from('tf_orders')
        .update({ order_no: orderNo })
        .eq('id', orderId);
      if (error && !this.isMissingColumnError(error)) {
        this.logger.warn(`[Order] 回写 order_no 失败: ${error.message}`);
      }
    } catch (e) {
      this.logger.warn(
        `[Order] 回写 order_no 异常: ${e instanceof Error ? e.message : e}`,
      );
    }
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


  /** 外卖坐标快照：RPC 建单后尽力补写；缺列时静默忽略 */
  private async patchOrderCoordinates(
    orderId: string,
    coords: {
      shopLatitude?: number;
      shopLongitude?: number;
      deliveryLatitude?: number;
      deliveryLongitude?: number;
    },
  ): Promise<void> {
    if (!hasSupabase() || !supabase) return;
    const payload: Record<string, unknown> = {};
    if (coords.shopLatitude !== undefined) payload.shop_latitude = coords.shopLatitude;
    if (coords.shopLongitude !== undefined) payload.shop_longitude = coords.shopLongitude;
    if (coords.deliveryLatitude !== undefined) payload.delivery_latitude = coords.deliveryLatitude;
    if (coords.deliveryLongitude !== undefined) payload.delivery_longitude = coords.deliveryLongitude;
    if (Object.keys(payload).length === 0) return;
    try {
      const { error } = await supabase.from('tf_orders').update(payload).eq('id', orderId);
      if (error) {
        this.logger.warn(`[Order] 坐标快照写入跳过: ${error.message}`);
      }
    } catch (e) {
      this.logger.warn(`[Order] 坐标快照写入异常: ${e instanceof Error ? e.message : e}`);
    }
  }

  private async createOrderLegacyFallback(params: {
    orderId: string;
    orderNo?: string;
    dto: CreateOrderDto;
    total: number;
    deliveryFee: number;
    items: OrderItemRecord[];
    now: string;
    shopLatitude?: number;
    shopLongitude?: number;
    deliveryLatitude?: number;
    deliveryLongitude?: number;
  }): Promise<void> {
    if (!supabase) {
      throw new BadRequestException('创建订单失败: Supabase 不可用');
    }
    const {
      orderId,
      orderNo,
      dto,
      total,
      deliveryFee,
      items,
      now,
      shopLatitude,
      shopLongitude,
      deliveryLatitude,
      deliveryLongitude,
    } = params;

    const coordFields: Record<string, unknown> = {};
    if (shopLatitude !== undefined) coordFields.shop_latitude = shopLatitude;
    if (shopLongitude !== undefined) coordFields.shop_longitude = shopLongitude;
    if (deliveryLatitude !== undefined) coordFields.delivery_latitude = deliveryLatitude;
    if (deliveryLongitude !== undefined) coordFields.delivery_longitude = deliveryLongitude;

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

    if (orderNo) {
      // 优先尝试带业务单号的写入；缺列时自动回退无 order_no 的候选
      orderPayloadCandidates.unshift(
        {
          id: orderId,
          order_no: orderNo,
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
        {
          id: orderId,
          order_no: orderNo,
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
      );
    }

    if (Object.keys(coordFields).length > 0) {
      // 坐标列可能尚未迁移：优先尝试带坐标写入，缺列时自动回退
      const withCoords = orderPayloadCandidates.map((payload) => ({
        ...payload,
        ...coordFields,
      }));
      orderPayloadCandidates.unshift(...withCoords);
    }

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
    const id = row.id;
    const rawNo = row.order_no || row.orderNo;
    return {
      id,
      orderNo: rawNo || this.compatOrderNo(id),
      shopId: row.shop_id,
      userId: row.user_id,
      riderId: row.rider_id || undefined,
      status: row.status as OrderStatus,
      total: row.total,
      deliveryFee: row.delivery_fee || 0,
      deliveryType: row.delivery_type as DeliveryType,
      address: row.address,
      shopLatitude: normalizeGeoPoint(row.shop_latitude, row.shop_longitude)?.latitude,
      shopLongitude: normalizeGeoPoint(row.shop_latitude, row.shop_longitude)?.longitude,
      deliveryLatitude: normalizeGeoPoint(row.delivery_latitude, row.delivery_longitude)?.latitude,
      deliveryLongitude: normalizeGeoPoint(row.delivery_latitude, row.delivery_longitude)?.longitude,
      tableNo: row.table_no,
      remark: row.remark,
      cancelReason: row.cancel_reason || undefined,
      rejectReason: row.reject_reason || undefined,
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
    const orderNo = await this.allocateOrderNo(dto.shopId, dto.deliveryType);

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

    // 外卖：快照店铺/配送坐标（腾讯地图 GCJ-02）；坐标缺失时尝试 geocode，仍失败则允许下单但地图降级
    let shopLatitude: number | undefined;
    let shopLongitude: number | undefined;
    let deliveryLatitude: number | undefined;
    let deliveryLongitude: number | undefined;
    if (dto.deliveryType === DeliveryType.DELIVERY) {
      const shopPoint = normalizeGeoPoint(
        (shopForOrder as any).latitude,
        (shopForOrder as any).longitude,
      ) || await resolveGeoPoint({
        address: (shopForOrder as any).address,
        latitude: (shopForOrder as any).latitude,
        longitude: (shopForOrder as any).longitude,
      });
      shopLatitude = shopPoint?.latitude;
      shopLongitude = shopPoint?.longitude;

      let incomingLat = dto.deliveryLatitude;
      let incomingLng = dto.deliveryLongitude;

      // 客户端未传坐标时，尝试从地址簿按 detail 匹配已选点坐标
      if (
        (incomingLat === undefined || incomingLng === undefined)
        && dto.userId
        && dto.address
      ) {
        try {
          const book = await this.addressService.findByUserId(dto.userId, dto.shopId);
          const normalized = dto.address.replace(/\s+/g, '');
          const hit = book.find((a) => (a.detail || '').replace(/\s+/g, '') === normalized)
            || book.find((a) => {
              const d = (a.detail || '').replace(/\s+/g, '');
              return !!d && (normalized.includes(d) || d.includes(normalized));
            });
          if (hit?.latitude !== undefined && hit?.longitude !== undefined) {
            incomingLat = hit.latitude;
            incomingLng = hit.longitude;
          }
        } catch (e) {
          this.logger.warn(
            `[Order] 地址簿坐标回退失败: ${e instanceof Error ? e.message : e}`,
          );
        }
      }

      const deliveryPoint = await resolveGeoPoint({
        address: dto.address,
        latitude: incomingLat,
        longitude: incomingLng,
      });
      deliveryLatitude = deliveryPoint?.latitude;
      deliveryLongitude = deliveryPoint?.longitude;
    }

    const order: OrderRecord = {
      id: orderId,
      orderNo,
      shopId: dto.shopId,
      userId: dto.userId || '',
      status: OrderStatus.PENDING_PAYMENT,
      total,
      deliveryFee,
      deliveryType: dto.deliveryType,
      address: dto.address,
      shopLatitude,
      shopLongitude,
      deliveryLatitude,
      deliveryLongitude,
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
      const itemsJsonb = items.map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        specDesc: item.specDesc,
        imageUrl: item.imageUrl,
      }));

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
        p_order_no: orderNo,
      });

      if (rpcErr) {
        const msg = rpcErr.message || '';
        const canFallback =
          /p_invoice_|p_order_no|order_no|invoice_needed|invoice_title|invoice_tax_no|Could not find the function|delivery_fee|column|does not exist|PGRST202|42883/i.test(
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
            orderNo,
            dto,
            total,
            deliveryFee,
            items,
            now,
            shopLatitude,
            shopLongitude,
            deliveryLatitude,
            deliveryLongitude,
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
              orderNo,
              dto,
              total,
              deliveryFee,
              items,
              now,
              shopLatitude,
              shopLongitude,
              deliveryLatitude,
              deliveryLongitude,
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

    // 兼容旧 RPC/缺列：确保业务单号尽量落库（新单内存对象已含 orderNo）
    if (hasSupabase() && supabase && order.orderNo) {
      await this.persistOrderNo(orderId, order.orderNo);
    }

    // atomic_create_order 不含坐标参数：创建后补写快照坐标（缺列则忽略）
    if (dto.deliveryType === DeliveryType.DELIVERY) {
      await this.patchOrderCoordinates(orderId, {
        shopLatitude,
        shopLongitude,
        deliveryLatitude,
        deliveryLongitude,
      });
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
      return this.ensureDeliveryCoordinates(order);
    }

    assertMemoryFallbackAllowed('OrderService');
    const order = memoryOrders.get(id);
    if (!order) throw new NotFoundException(`订单 ${id} 不存在`);
    return this.ensureDeliveryCoordinates(order);
  }

  /** 历史单/旧链路缺坐标时，读取时补齐并尽力回写 */
  private async ensureDeliveryCoordinates(order: OrderRecord): Promise<OrderRecord> {
    if (order.deliveryType !== DeliveryType.DELIVERY) return order;

    let shopLatitude = order.shopLatitude;
    let shopLongitude = order.shopLongitude;
    let deliveryLatitude = order.deliveryLatitude;
    let deliveryLongitude = order.deliveryLongitude;
    let changed = false;

    if (shopLatitude === undefined || shopLongitude === undefined) {
      try {
        const shop = await this.shopService.findById(order.shopId);
        const shopPoint = normalizeGeoPoint(shop.latitude, shop.longitude)
          || await resolveGeoPoint({
            address: shop.address,
            latitude: shop.latitude,
            longitude: shop.longitude,
          });
        if (shopPoint) {
          shopLatitude = shopPoint.latitude;
          shopLongitude = shopPoint.longitude;
          changed = true;
        }
      } catch (e) {
        this.logger.warn(
          `[Order] 补齐店铺坐标失败: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    if (
      (deliveryLatitude === undefined || deliveryLongitude === undefined)
      && order.address
    ) {
      // 优先从地址簿匹配已选点坐标，避免 geocode 额度耗尽
      try {
        const book = await this.addressService.findByUserId(order.userId, order.shopId);
        const normalized = order.address.replace(/\s+/g, '');
        const hit = book.find((a) => (a.detail || '').replace(/\s+/g, '') === normalized)
          || book.find((a) => {
            const d = (a.detail || '').replace(/\s+/g, '');
            return !!d && (normalized.includes(d) || d.includes(normalized));
          });
        if (hit?.latitude !== undefined && hit?.longitude !== undefined) {
          deliveryLatitude = hit.latitude;
          deliveryLongitude = hit.longitude;
          changed = true;
        }
      } catch (e) {
        this.logger.warn(
          `[Order] 地址簿坐标回退失败: ${e instanceof Error ? e.message : e}`,
        );
      }

      if (deliveryLatitude === undefined || deliveryLongitude === undefined) {
        const deliveryPoint = await resolveGeoPoint({
          address: order.address,
          latitude: deliveryLatitude,
          longitude: deliveryLongitude,
        });
        if (deliveryPoint) {
          deliveryLatitude = deliveryPoint.latitude;
          deliveryLongitude = deliveryPoint.longitude;
          changed = true;
        }
      }
    }

    if (!changed) return order;

    order.shopLatitude = shopLatitude;
    order.shopLongitude = shopLongitude;
    order.deliveryLatitude = deliveryLatitude;
    order.deliveryLongitude = deliveryLongitude;

    if (hasSupabase() && supabase) {
      await this.patchOrderCoordinates(order.id, {
        shopLatitude,
        shopLongitude,
        deliveryLatitude,
        deliveryLongitude,
      });
    } else if (memoryOrders.has(order.id)) {
      memoryOrders.set(order.id, order);
    }

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
    status?: string,
  ): Promise<PaginatedData<OrderRecord>> {
    if (hasSupabase() && supabase) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from('tf_orders')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (status) {
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
    let userOrders = Array.from(memoryOrders.values())
      .filter((o) => o.userId === userId)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    if (status) {
      userOrders = userOrders.filter((o) => o.status === status);
    }
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


  /**
   * 骑手跨店抢单池：所有店铺 PREPARING 且无骑手的外送单
   */
  async findDeliveryPool(
    page = 1,
    pageSize = 20,
    shopId?: string,
  ): Promise<PaginatedData<OrderRecord>> {
    if (hasSupabase() && supabase) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from('tf_orders')
        .select('*', { count: 'exact' })
        .eq('delivery_type', DeliveryType.DELIVERY)
        .is('rider_id', null)
        .eq('status', OrderStatus.PREPARING)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (shopId) {
        query = query.eq('shop_id', shopId);
      }

      const { data, error, count } = await query;
      if (error) throw new BadRequestException(`查询抢单池失败: ${error.message}`);

      const orders = (data || []).map((row) => this.toRecord(row));
      const orderIds = orders.map((order) => order.id);
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
      .filter(
        (o) =>
          o.deliveryType === DeliveryType.DELIVERY &&
          !o.riderId &&
          o.status === OrderStatus.PREPARING &&
          (!shopId || o.shopId === shopId),
      )
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
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
    const reason = dto.reason?.trim();
    if (
      dto.status &&
      [OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(dto.status) &&
      !reason
    ) {
      throw new BadRequestException(
        dto.status === OrderStatus.REJECTED ? '拒单原因不能为空' : '取消原因不能为空',
      );
    }

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
        const reasonExtra =
          dto.status === OrderStatus.REJECTED
            ? { reject_reason: reason }
            : dto.status === OrderStatus.CANCELLED
              ? { cancel_reason: reason }
              : {};

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
          const updated = await this.updateOrderStatusDirect(
            id,
            previousStatus,
            dto.status,
            reasonExtra,
          );
          this.emitStatusEvents(updated, previousStatus);
          return updated;
        }

        if (Object.keys(reasonExtra).length > 0) {
          try {
            await supabase
              .from('tf_orders')
              .update({ ...reasonExtra, updated_at: new Date().toISOString() })
              .eq('id', id);
          } catch (e) {
            this.logger.warn(
              `[Order] 写入取消/拒单原因失败: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        order.status = dto.status;
        if (dto.status === OrderStatus.REJECTED) order.rejectReason = reason;
        if (dto.status === OrderStatus.CANCELLED) order.cancelReason = reason;
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
      if (dto.status === OrderStatus.REJECTED) order.rejectReason = reason;
      if (dto.status === OrderStatus.CANCELLED) order.cancelReason = reason;
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

  /**
   * 取消订单（仅 pending_payment / paid）。
   * - 传入 userId：按顾客本人订单校验（顾客自主取消）
   * - 不传 userId：商家/管理员在控制器侧已做店铺访问校验后取消
   * 商家接单后（accepted 及之后）不可直接取消，需走拒单/客服协商等流程。
   */
  async cancelOrder(id: string, userId?: string, reason?: string): Promise<OrderRecord> {
    const order = await this.findById(id);
    if (userId && order.userId !== userId) {
      throw new BadRequestException('不能取消他人的订单');
    }
    if (![OrderStatus.PENDING_PAYMENT, OrderStatus.PAID].includes(order.status)) {
      throw new BadRequestException(`订单状态为 ${order.status}，不允许取消`);
    }
    const cancelReason = reason?.trim();
    if (!cancelReason) {
      throw new BadRequestException('取消原因不能为空');
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
          { cancel_reason: cancelReason },
        );
        try {
          this.orderGateway.emitOrderUpdated(updated, previousStatus);
        } catch (e) {
          this.logger.warn(e instanceof Error ? e.message : String(e));
        }
        return updated;
      }

      try {
        await supabase
          .from('tf_orders')
          .update({ cancel_reason: cancelReason, updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch (e) {
        this.logger.warn(
          `[Order] 写入取消原因失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      order.status = OrderStatus.CANCELLED;
      order.cancelReason = cancelReason;
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
    return this.updateStatus(id, { status: OrderStatus.CANCELLED, reason: cancelReason });
  }

  async reorder(userId: string, dto: { shopId: string; items: CreateOrderDto['items']; deliveryType: DeliveryType; address?: string; tableNo?: string; remark?: string; contactName?: string; contactPhone?: string; deliveryLatitude?: number; deliveryLongitude?: number }): Promise<OrderRecord> {
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
      deliveryLatitude: (dto as any).deliveryLatitude,
      deliveryLongitude: (dto as any).deliveryLongitude,
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
    opts?: { status?: string; maxRows?: number; format?: 'csv' | 'xlsx' | 'both' },
  ): Promise<{
    csv: string;
    xlsxBase64?: string;
    count: number;
    filename: string;
    xlsxFilename?: string;
    contentType?: string;
  }> {
    const maxRows = Math.min(Math.max(opts?.maxRows || 1000, 1), 5000);
    const format = opts?.format || 'both';
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
    const day = this.formatOrderDateKey();
    const dayDash = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
    const statusPart = opts?.status ? `_${opts.status}` : '';
    const csvFilename = `orders${statusPart}_${dayDash}.csv`;
    const xlsxFilename = `orders${statusPart}_${dayDash}.xlsx`;

    const fenToYuan = (fen: number) => ((Number(fen) || 0) / 100).toFixed(2);
    const formatDateTime = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const displayNo = (o: OrderRecord) => o.orderNo || this.compatOrderNo(o.id);

    let csv = '';
    if (format === 'csv' || format === 'both') {
      const escape = (v: unknown) => {
        const s = v == null ? '' : String(v);
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const header = [
        '订单号',
        '业务单号',
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
            displayNo(o),
            ORDER_STATUS_LABEL[o.status] || o.status,
            DELIVERY_TYPE_LABEL[o.deliveryType] || o.deliveryType,
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
            formatDateTime(o.createdAt),
            formatDateTime(o.updatedAt),
          ]
            .map(escape)
            .join(','),
        );
      }
      csv = '\uFEFF' + lines.join('\n');
    }

    let xlsxBase64: string | undefined;
    if (format === 'xlsx' || format === 'both') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'taste-food';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('订单导出', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      sheet.columns = [
        { header: '订单号', key: 'id', width: 38 },
        { header: '业务单号', key: 'orderNo', width: 22 },
        { header: '状态', key: 'status', width: 12 },
        { header: '配送类型', key: 'deliveryType', width: 12 },
        { header: '金额(元)', key: 'total', width: 12 },
        { header: '配送费(元)', key: 'deliveryFee', width: 12 },
        { header: '桌号', key: 'tableNo', width: 10 },
        { header: '地址', key: 'address', width: 28 },
        { header: '联系人', key: 'contactName', width: 12 },
        { header: '电话', key: 'contactPhone', width: 14 },
        { header: '备注', key: 'remark', width: 20 },
        { header: '需要发票', key: 'invoiceNeeded', width: 10 },
        { header: '发票抬头', key: 'invoiceTitle', width: 18 },
        { header: '税号', key: 'invoiceTaxNo', width: 18 },
        { header: '商品摘要', key: 'itemsSummary', width: 36 },
        { header: '创建时间', key: 'createdAt', width: 20 },
        { header: '更新时间', key: 'updatedAt', width: 20 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 22;

      for (const o of rows) {
        const itemsSummary = (o.items || [])
          .map((it) => `${it.name}x${it.quantity}`)
          .join('；');
        sheet.addRow({
          id: o.id,
          orderNo: displayNo(o),
          status: ORDER_STATUS_LABEL[o.status] || o.status,
          deliveryType: DELIVERY_TYPE_LABEL[o.deliveryType] || o.deliveryType,
          total: Number(fenToYuan(o.total)),
          deliveryFee: Number(fenToYuan(o.deliveryFee)),
          tableNo: o.tableNo || '',
          address: o.address || '',
          contactName: o.contactName || '',
          contactPhone: o.contactPhone || '',
          remark: o.remark || '',
          invoiceNeeded: o.invoiceNeeded ? '是' : '否',
          invoiceTitle: o.invoiceTitle || '',
          invoiceTaxNo: o.invoiceTaxNo || '',
          itemsSummary,
          createdAt: formatDateTime(o.createdAt),
          updatedAt: formatDateTime(o.updatedAt),
        });
      }

      const thin = {
        style: 'thin' as const,
        color: { argb: 'FFB0B0B0' },
      };
      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          cell.border = { top: thin, left: thin, bottom: thin, right: thin };
          if (rowNumber > 1 && (colNumber === 5 || colNumber === 6)) {
            cell.numFmt = '0.00';
            cell.alignment = { horizontal: 'right' };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const bytes = Buffer.isBuffer(buffer)
        ? buffer
        : Buffer.from(buffer as ArrayBuffer);
      xlsxBase64 = bytes.toString('base64');
    }

    // 默认仍返回 csv 以兼容旧 admin；同时附带 xlsx
    const primaryIsXlsx = format === 'xlsx';
    return {
      csv: csv || '',
      xlsxBase64,
      count: rows.length,
      filename: primaryIsXlsx ? xlsxFilename : csvFilename,
      xlsxFilename,
      contentType: primaryIsXlsx
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8',
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
    // days <= 0 表示「全部」：以最早订单为起点，跨度上限 366 天，避免桶数量失控
    const ALL_TIME_MAX_DAYS = 366;
    const allTime = !days || days <= 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const revenueStatuses: OrderStatus[] = [
      OrderStatus.COMPLETED,
      OrderStatus.DELIVERING,
      OrderStatus.PREPARING,
    ];

    const dateKey = (value: string | number | Date): string => {
      const d = new Date(value);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // 根据订单集合确定实际起点（全部模式），并统一生成连续日期桶
    const buildBuckets = (spanDays: number): { buckets: DailyStatsItem[]; bucketMap: Map<string, DailyStatsItem>; start: Date } => {
      const safeSpan = Math.max(1, Math.min(spanDays, ALL_TIME_MAX_DAYS));
      const s = new Date(today);
      s.setDate(s.getDate() - (safeSpan - 1));
      const list: DailyStatsItem[] = [];
      for (let i = 0; i < safeSpan; i++) {
        const d = new Date(s);
        d.setDate(d.getDate() + i);
        list.push({ date: dateKey(d), orders: 0, revenue: 0 });
      }
      return { buckets: list, bucketMap: new Map(list.map((b) => [b.date, b])), start: s };
    };

    const spanFromEarliest = (earliestIso?: string): number => {
      if (!earliestIso) return 1;
      const earliest = new Date(earliestIso);
      earliest.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - earliest.getTime()) / 86400000);
      return diffDays + 1;
    };

    if (hasSupabase() && supabase) {
      let query = supabase
        .from('tf_orders')
        .select('status, total, created_at')
        .eq('shop_id', shopId);
      if (!allTime) {
        const s = new Date(today);
        s.setDate(s.getDate() - (days - 1));
        query = query.gte('created_at', s.toISOString());
      }
      const { data, error } = await query;
      if (error) {
        this.logger.warn(`[OrderService] getDailyStats error: ${error.message}`);
        const { buckets } = buildBuckets(allTime ? 1 : days);
        return buckets;
      }
      const rows = (data || []) as OrderRow[];
      const spanDays = allTime
        ? spanFromEarliest(rows.reduce<string | undefined>((min, r) => (!min || r.created_at < min ? r.created_at : min), undefined))
        : days;
      const { buckets, bucketMap } = buildBuckets(spanDays);
      for (const row of rows) {
        const bucket = bucketMap.get(dateKey(row.created_at));
        if (!bucket) continue; // 超出窗口的订单忽略
        bucket.orders += 1;
        if (revenueStatuses.includes(row.status as OrderStatus)) {
          bucket.revenue += row.total || 0;
        }
      }
      return buckets;
    }

    assertMemoryFallbackAllowed('OrderService');
    const startForFilter = (() => {
      if (allTime) return 0;
      const s = new Date(today);
      s.setDate(s.getDate() - (days - 1));
      return s.getTime();
    })();
    const filtered = Array.from(memoryOrders.values()).filter(
      (o) => o.shopId === shopId && new Date(o.createdAt).getTime() >= startForFilter,
    );
    const spanDays = allTime
      ? spanFromEarliest(
          filtered.reduce<string | undefined>(
            (min, o) => (!min || o.createdAt < min ? o.createdAt : min),
            undefined,
          ),
        )
      : days;
    const { buckets, bucketMap } = buildBuckets(spanDays);
    for (const o of filtered) {
      const bucket = bucketMap.get(dateKey(o.createdAt));
      if (!bucket) continue;
      bucket.orders += 1;
      if (revenueStatuses.includes(o.status)) {
        bucket.revenue += o.total;
      }
    }
    return buckets;
  }

  /**
   * 店铺订单状态分布（用于 Dashboard 饼图）
   * @param days 可选：仅统计近 N 天（按 created_at）；不传则全量
   */
  async getStatusDistribution(shopId: string, days?: number): Promise<StatusDistributionItem[]> {
    const startIso = (() => {
      if (!days || days <= 0) return undefined;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(today);
      start.setDate(start.getDate() - (days - 1));
      return start.toISOString();
    })();

    if (hasSupabase() && supabase) {
      let query = supabase
        .from('tf_orders')
        .select('status')
        .eq('shop_id', shopId);
      if (startIso) {
        query = query.gte('created_at', startIso);
      }
      const { data, error } = await query;
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
    const startMs = startIso ? new Date(startIso).getTime() : undefined;
    const filtered = Array.from(memoryOrders.values()).filter((o) => {
      if (o.shopId !== shopId) return false;
      if (startMs != null && new Date(o.createdAt).getTime() < startMs) return false;
      return true;
    });
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
