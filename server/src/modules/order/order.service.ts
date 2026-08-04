import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, Inject, forwardRef, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as ExcelJS from 'exceljs';
import { OrderStatus, DeliveryType, PromotionType, ShopStatus, MenuItemStatus } from '../../common/constants/enums';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderGateway } from './order.gateway';
import { PromotionService } from '../promotion/promotion.service';
import { ShopService } from '../shop/shop.service';
import { AddressService } from '../address/address.service';
import { MenuService } from '../menu/menu.service';
import { InboxService } from '../inbox/inbox.service';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import { DeliveryTrackPointDto } from './dto/delivery-track.dto';
import {
  haversineDistanceMeters,
  isValidGeoPoint,
  normalizeGeoPoint,
  resolveDeliveryConfirmRadiusM,
  resolveGeoPoint,
} from '../../common/utils/tencent-map';
import { DeliverOrderDto } from './dto/deliver-order.dto';
import {
  DELIVERY_CONFIRM_ACCURACY_BUFFER_MAX_M,
  DELIVERY_CONFIRM_RADIUS_M,
  DELIVERY_CONFIRM_RADIUS_MAX_M,
  DELIVERY_CONFIRM_RADIUS_MIN_M,
  DELIVERY_PROOF_MAX_PHOTOS,
  DELIVERY_PROOF_MIN_PHOTOS,
} from '../../common/constants/delivery';

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

export interface OrderStatusHistoryRecord {
  status: OrderStatus;
  time: string;
  fromStatus?: OrderStatus;
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
  statusHistory?: OrderStatusHistoryRecord[];
  /** 当前骑手手上配送中的外送单数量（含当前单） */
  riderDeliveryCount?: number;
  /** 店铺送达围栏（米） */
  deliveryConfirmRadiusM?: number;
  /** 外卖送达凭证 */
  deliveryProof?: DeliveryProofRecord;
  estimatedCompletion?: string;
  cancelRequestedAt?: string;
  cancelRequestReason?: string;
  lastUrgedAt?: string;
  urgeCount?: number;
  shopPhone?: string;
  shopName?: string;
  /** 店铺地址（详情附加，自取订单展示/导航用） */
  shopAddress?: string;
  riderPhone?: string;
  riderName?: string;
  createdAt: string;
  updatedAt: string;
}

/** 订单列表状态标签数量 */
export interface OrderStatusCounts {
  all: number;
  pending_payment: number;
  paid: number;
  accepted: number;
  preparing: number;
  ready_for_delivery: number;
  ready_for_pickup: number;
  delivering: number;
  refund: number;
  completed: number;
}

export interface DeliveryProofPhotoRecord {
  url: string;
  path?: string;
  uploadedAt?: string;
}

export interface DeliveryProofRecord {
  photos: DeliveryProofPhotoRecord[];
  deliveredAt: string;
  confirmLatitude?: number;
  confirmLongitude?: number;
  confirmAccuracy?: number;
  confirmDistanceM?: number;
  confirmRadiusM?: number;
  riderId?: string;
  courierName?: string;
  courierPhone?: string;
  confirmSource?: string;
  forceReason?: string;
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

/** 骑手一次无感定位上报的结果（同步到其全部配送中订单） */
export interface RiderLocationReportResult {
  /** 实际写入轨迹点的订单数 */
  reported: number;
  /** 本次同步的订单 ID 列表 */
  orderIds: string[];
  recordedAt: string;
  /** 骑手当前配送中订单数 */
  riderDeliveryCount: number;
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
  estimated_completion?: string;
  cancel_requested_at?: string;
  cancel_request_reason?: string;
  last_urged_at?: string;
  urge_count?: number;
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

interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  shop_id: string;
  status: string;
  from_status?: string | null;
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

/** 不限时间维度的待处理聚合（区别于 getTodayStats 的「今日」口径） */
export interface PendingStats {
  /** 待接单：paid（已支付，等待商家接单） */
  paid: number;
  /** 待备餐：accepted（商家已接单，等待开始备餐） */
  accepted: number;
  /** 合计 = paid + accepted */
  total: number;
}

export interface DailyStatsItem {
  date: string; // YYYY-MM-DD
  orders: number;
  revenue: number;
}

// Memory fallback storage
const memoryOrders: Map<string, OrderRecord> = new Map();

/** 送达凭证内存回退（orderId -> proof） */
const memoryDeliveryProofs: Map<string, DeliveryProofRecord> = new Map();
const memoryDeliveryTracks: Map<string, DeliveryTrackPointRecord[]> = new Map();
const memoryOrderStatusHistory: Map<string, OrderStatusHistoryRecord[]> = new Map();
// 旧库无 rider_id 列时，用内存记录抢单归属（进程内有效）
const memoryRiderClaims: Map<string, string> = new Map();
/** 单个骑手一次无感定位最多同步的配送中订单数 */
const RIDER_LOCATION_MAX_ORDERS = 50;

/** 店铺日序号（内存）：key = shopId:YYYYMMDD */
const memoryOrderSeq: Map<string, number> = new Map();

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: '待支付',
  paid: '已支付',
  accepted: '已接单',
  preparing: '制作中',
  ready_for_delivery: '待配送',
  ready_for_pickup: '待取餐',
  delivering: '配送中',
  completed: '已完成',
  cancelled: '已取消',
  rejected: '已拒单',
};

/** 待支付超时（分钟） */
const PAYMENT_TIMEOUT_MINUTES = 5;
/** 催单冷却（分钟） */
const ORDER_URGE_COOLDOWN_MINUTES = 10;

const CUSTOMER_CANCELLABLE = new Set<OrderStatus>([
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
]);
const MERCHANT_CANCELLABLE = new Set<OrderStatus>([
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
]);
const CANCEL_REQUESTABLE = new Set<OrderStatus>([
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
]);
const ACTIVE_STATUS_GROUP = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.DELIVERING,
];
const HISTORY_STATUS_GROUP = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
];

/** 退款售后终态；进行中的取消申请另用 cancel_requested_at 判定 */
const REFUND_STATUS_GROUP = [
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
];

function isRefundStatusGroup(status?: string): boolean {
  if (!status || !String(status).trim()) return false;
  const raw = String(status).trim().toLowerCase();
  return raw === 'refund' || raw === 'after_sale' || raw === 'after-sale';
}

/** 仅「售后待处理」：顾客已申请取消、商家尚未处理 */
function isCancelRequestPendingFilter(status?: string): boolean {
  if (!status || !String(status).trim()) return false;
  const raw = String(status).trim().toLowerCase();
  return raw === 'cancel_request' || raw === 'after_sale_pending';
}

function resolveStatusFilter(status?: string): string[] | undefined {
  if (!status || !String(status).trim()) return undefined;
  const raw = String(status).trim().toLowerCase();
  if (raw === 'active') return [...ACTIVE_STATUS_GROUP];
  if (raw === 'history') return [...HISTORY_STATUS_GROUP];
  if (raw === 'review') return [OrderStatus.COMPLETED];
  if (isRefundStatusGroup(raw)) return [...REFUND_STATUS_GROUP];
  if (raw.includes(',')) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return [raw];
}

/** 退款售后：已取消/已拒单，或正在申请取消 */
function matchesRefundAfterSale(order: { status: string; cancelRequestedAt?: string | null }): boolean {
  if (REFUND_STATUS_GROUP.includes(order.status as OrderStatus)) return true;
  return Boolean(order.cancelRequestedAt);
}

/** 给 supabase 查询挂上 status / 退款售后 条件 */
function applyOrderStatusQueryFilter<T extends {
  eq: Function;
  in: Function;
  or: Function;
  not: Function;
}>(
  query: T,
  status?: string,
): T {
  if (isCancelRequestPendingFilter(status)) {
    return query.not('cancel_requested_at', 'is', null);
  }
  if (isRefundStatusGroup(status)) {
    // cancelled/rejected 或 仍在处理的取消申请
    return query.or(
      `status.in.(${REFUND_STATUS_GROUP.join(',')}),cancel_requested_at.not.is.null`,
    );
  }
  const statusList = resolveStatusFilter(status);
  if (statusList?.length === 1) {
    return query.eq('status', statusList[0]);
  }
  if (statusList && statusList.length > 1) {
    return query.in('status', statusList);
  }
  return query;
}

/** 关键词模糊匹配：订单号/联系人姓名/联系电话 */
function applyOrderKeywordFilter<T extends {
  or: Function;
}>(
  query: T,
  keyword?: string,
): T {
  if (!keyword?.trim()) return query;
  const q = keyword.trim();
  // Supabase PostgREST: ilike 做大小写不敏感模糊匹配
  return query.or(`order_no.ilike.%${q}%,contact_name.ilike.%${q}%,contact_phone.ilike.%${q}%`);
}


const DELIVERY_TYPE_LABEL: Record<string, string> = {
  delivery: '外卖配送',
  pickup: '到店自取',
  dine_in: '堂食',
};

@Injectable()
export class OrderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderService.name);
  private paymentTimeoutTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(forwardRef(() => OrderGateway))
    private readonly orderGateway: OrderGateway,
    private readonly promotionService: PromotionService,
    private readonly shopService: ShopService,
    private readonly menuService: MenuService,
    private readonly addressService: AddressService,
    private readonly inboxService: InboxService,
  ) {}

  onModuleInit() {
    // 单测环境不启动定时器，避免挂起 node:test 进程
    if (process.env.NODE_ENV === 'test') return;

    // 每 60s 扫描一次超时未支付订单
    this.paymentTimeoutTimer = setInterval(() => {
      this.cancelExpiredPendingPayments().catch((e) => {
        this.logger.warn(
          `[Order] 支付超时扫描失败: ${e instanceof Error ? e.message : e}`,
        );
      });
    }, 60_000);
    // 允许进程在仅剩该定时器时退出
    this.paymentTimeoutTimer.unref?.();

    // 启动后稍延迟跑一轮
    const bootTimer = setTimeout(() => {
      this.cancelExpiredPendingPayments().catch(() => undefined);
    }, 5_000);
    bootTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.paymentTimeoutTimer) {
      clearInterval(this.paymentTimeoutTimer);
      this.paymentTimeoutTimer = null;
    }
  }

  private isMissingColumnError(error: { message?: string } | null | undefined): boolean {
    const msg = String(error?.message || '').toLowerCase();
    // 兼容 PostgREST schema cache 与 Postgres 缺列错误文案
    return (
      (msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache'))) ||
      (msg.includes('could not find the') && msg.includes('column'))
    );
  }

  private isMissingStatusHistoryStorageError(error: { message?: string } | null | undefined): boolean {
    const msg = String(error?.message || '').toLowerCase();
    return (
      msg.includes('tf_order_status_history') ||
      msg.includes('schema cache') ||
      msg.includes('does not exist') ||
      this.isMissingColumnError(error)
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
   * 从已有 order_no 中解析当日流水段（末4位）。
   * 仅匹配同 dateKey + 配送类型码的单号，店铺序号段允许任意2位（防店铺序号漂移漏判）。
   * 不匹配（含 NULL / TMP_ / 旧格式）返回 0。
   */
  private parseOrderSeq(
    orderNo: string | null | undefined,
    dateKey: string,
    deliveryCode: string,
  ): number {
    if (!orderNo) return 0;
    const m = orderNo.match(
      new RegExp(`^TF${dateKey}${deliveryCode}\\d{2}(\\d{4})$`),
    );
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * 生成业务订单号：TF + YYYYMMDD + 配送类型码(D/P/I) + 店铺序号2位 + 当日流水4位
   * 例：TF20260726D010001（2026-07-26 外卖 第1家店 第1单）
   *
   * 流水采用「高水位」策略：取当日该(店铺+配送类型)组已有 order_no 的最大流水段 +1，
   * 而非「订单条数 +1」。这样删单后计数变小也不会与既有单号重复（不跳号/不撞号），
   * 序号只增不减；并发时靠 order_no 唯一索引 + 上层重试兜底。
   */
  private async allocateOrderNo(shopId: string, deliveryType: string): Promise<string> {
    const dateKey = this.formatOrderDateKey();
    const deliveryCode = this.deliveryTypeCode(deliveryType);
    const shopSeq = await this.shopSeqNo(shopId);
    const seqKey = `${shopId}:${dateKey}:${deliveryType}`;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    let maxSeq = 0;

    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_orders')
          .select('order_no')
          .eq('shop_id', shopId)
          .eq('delivery_type', deliveryType)
          .gte('created_at', start.toISOString())
          .not('order_no', 'is', null);
        if (!error && data) {
          for (const row of data) {
            const s = this.parseOrderSeq(
              (row as { order_no?: string }).order_no,
              dateKey,
              deliveryCode,
            );
            if (s > maxSeq) maxSeq = s;
          }
        }
      } catch (e) {
        this.logger.warn(
          `[Order] 统计当日订单最大流水失败: ${e instanceof Error ? e.message : e}`,
        );
      }
    } else {
      const startMs = start.getTime();
      for (const o of memoryOrders.values()) {
        if (
          o.shopId === shopId &&
          o.deliveryType === deliveryType &&
          new Date(o.createdAt).getTime() >= startMs
        ) {
          const s = this.parseOrderSeq(o.orderNo, dateKey, deliveryCode);
          if (s > maxSeq) maxSeq = s;
        }
      }
    }

    // 与同进程内存高水位对齐，避免单进程内并发分配重复
    const mem = memoryOrderSeq.get(seqKey) || 0;
    const seq = Math.max(maxSeq + 1, mem + 1);
    memoryOrderSeq.set(seqKey, seq);
    return this.buildOrderNo(deliveryCode, shopSeq, dateKey, seq);
  }

  /** 判断是否为 order_no 唯一约束冲突（并发下号撞号），用于创建时重试 */
  private isDuplicateOrderNoError(err: unknown): boolean {
    const e = err as { code?: string; message?: string } | null;
    const code = String(e?.code || '');
    const msg = (e?.message || '').toLowerCase();
    if (code === '23505') return true;
    if (msg.includes('idx_orders_order_no_unique')) return true;
    return msg.includes('duplicate key') && msg.includes('order_no');
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

    // T181 后 tf_orders 列已齐全，仅 status/updated_at 的 minimal 回退为历史缺列兼容死代码，已移除。

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
    await this.recordStatusHistory(order, toStatus, fromStatus, now);
    order.statusHistory = await this.fetchStatusHistory(order);
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
      estimatedCompletion: row.estimated_completion || row.estimatedCompletion || undefined,
      cancelRequestedAt: row.cancel_requested_at || row.cancelRequestedAt || undefined,
      cancelRequestReason: row.cancel_request_reason || row.cancelRequestReason || undefined,
      lastUrgedAt: row.last_urged_at || row.lastUrgedAt || undefined,
      urgeCount: typeof row.urge_count === 'number' ? row.urge_count : (row.urgeCount || 0),
      items: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toStatusHistoryRecord(row: OrderStatusHistoryRow): OrderStatusHistoryRecord {
    return {
      status: row.status as OrderStatus,
      fromStatus: row.from_status ? (row.from_status as OrderStatus) : undefined,
      time: row.recorded_at || row.created_at,
    };
  }

  private fallbackStatusHistory(order: OrderRecord): OrderStatusHistoryRecord[] {
    const history: OrderStatusHistoryRecord[] = [
      { status: OrderStatus.PENDING_PAYMENT, time: order.createdAt },
    ];
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      history.push({
        status: order.status,
        time: order.updatedAt || order.createdAt,
      });
    }
    return history;
  }

  private mergeFallbackStatusHistory(
    order: OrderRecord,
    history: OrderStatusHistoryRecord[],
  ): OrderStatusHistoryRecord[] {
    const byStatus = new Map<string, OrderStatusHistoryRecord>();
    for (const item of history) {
      if (!byStatus.has(item.status)) byStatus.set(item.status, item);
    }
    if (!byStatus.has(OrderStatus.PENDING_PAYMENT)) {
      byStatus.set(OrderStatus.PENDING_PAYMENT, {
        status: OrderStatus.PENDING_PAYMENT,
        time: order.createdAt,
      });
    }
    if (!byStatus.has(order.status)) {
      byStatus.set(order.status, {
        status: order.status,
        time: order.updatedAt || order.createdAt,
      });
    }
    return Array.from(byStatus.values()).sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );
  }

  private async fetchStatusHistory(order: OrderRecord): Promise<OrderStatusHistoryRecord[]> {
    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_order_status_history')
          .select('id, order_id, shop_id, status, from_status, recorded_at, created_at')
          .eq('order_id', order.id)
          .order('recorded_at', { ascending: true });
        if (error) {
          if (this.isMissingStatusHistoryStorageError(error)) {
            return this.fallbackStatusHistory(order);
          }
          this.logger.warn(`[Order] 查询状态历史失败，使用兜底时间: ${error.message}`);
          return this.fallbackStatusHistory(order);
        }
        const history = (data || []).map((row: OrderStatusHistoryRow) => this.toStatusHistoryRecord(row));
        return this.mergeFallbackStatusHistory(order, history);
      } catch (e) {
        this.logger.warn(
          `[Order] 查询状态历史异常，使用兜底时间: ${e instanceof Error ? e.message : e}`,
        );
        return this.fallbackStatusHistory(order);
      }
    }

    assertMemoryFallbackAllowed('OrderService');
    return this.mergeFallbackStatusHistory(order, memoryOrderStatusHistory.get(order.id) || []);
  }

  private async recordStatusHistory(
    order: Pick<OrderRecord, 'id' | 'shopId'>,
    status: OrderStatus,
    fromStatus?: OrderStatus | string,
    time = new Date().toISOString(),
  ): Promise<void> {
    const item: OrderStatusHistoryRecord = {
      status,
      fromStatus: fromStatus ? (String(fromStatus) as OrderStatus) : undefined,
      time,
    };

    const list = memoryOrderStatusHistory.get(order.id) || [];
    if (!list.some((h) => h.status === status)) {
      list.push(item);
      list.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      memoryOrderStatusHistory.set(order.id, list);
    }

    if (!hasSupabase() || !supabase) return;

    try {
      const { error } = await supabase
        .from('tf_order_status_history')
        .upsert(
          {
            order_id: order.id,
            shop_id: order.shopId,
            status,
            from_status: fromStatus || null,
            recorded_at: time,
            created_at: time,
          },
          { onConflict: 'order_id,status', ignoreDuplicates: true },
        );
      if (error && !this.isMissingStatusHistoryStorageError(error)) {
        this.logger.warn(`[Order] 写入状态历史失败: ${error.message}`);
      }
    } catch (e) {
      this.logger.warn(
        `[Order] 写入状态历史异常: ${e instanceof Error ? e.message : e}`,
      );
    }
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

    // T246.2 按配送类型净化互斥字段：
    // 客户端切换配送方式时可能残留上一次的桌号/地址，服务端兜底丢弃，
    // 避免自取单带桌号、堂食单带配送地址这类脏数据落库。
    this.sanitizeDeliveryFields(dto);

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
        if (menuItem.status && menuItem.status !== MenuItemStatus.ACTIVE) {
          throw new BadRequestException(`菜品 ${menuItem.name} 不存在或已下架`);
        }
        if (menuItem.shopId && menuItem.shopId !== dto.shopId) {
          throw new BadRequestException(`菜品 ${menuItem.name} 不属于当前店铺`);
        }
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

    // 外卖：快照店铺/配送坐标（腾讯地图 GCJ-02）；收货坐标必填（客户端选点 / 地址簿 / geocode），缺失则拒单
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

      const deliveryPoint = normalizeGeoPoint(incomingLat, incomingLng)
        || await resolveGeoPoint({
          address: dto.address,
          latitude: incomingLat,
          longitude: incomingLng,
        });
      deliveryLatitude = deliveryPoint?.latitude;
      deliveryLongitude = deliveryPoint?.longitude;

      if (
        !isValidGeoPoint({
          latitude: deliveryLatitude as number,
          longitude: deliveryLongitude as number,
        })
      ) {
        throw new BadRequestException(
          '收货地址缺少有效坐标，请在地址簿地图选点后再下单',
        );
      }
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

      // 业务单号可能在高并发下撞唯一索引，撞号时重新分配并重试（最多3次）
      const buildAtomicParams = (no: string) => ({
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
        p_order_no: no,
      });

      let currentOrderNo = orderNo;
      let rpcErr: { code?: string; message?: string } | null = null;
      for (let attempt = 0; ; attempt++) {
        const res = await supabase.rpc(
          'atomic_create_order',
          buildAtomicParams(currentOrderNo),
        );
        rpcErr = res.error;
        if (rpcErr && this.isDuplicateOrderNoError(rpcErr) && attempt < 3) {
          const next = await this.allocateOrderNo(dto.shopId, dto.deliveryType);
          this.logger.warn(
            `[Order] 订单号 ${currentOrderNo} 撞号(唯一索引)，重试#${attempt + 1} → ${next}`,
          );
          currentOrderNo = next;
          continue;
        }
        break;
      }
      // 重试后单号可能已变，同步回内存订单对象供后续 persist / WS 使用
      if (order.orderNo !== currentOrderNo) {
        order.orderNo = currentOrderNo;
      }

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
            orderNo: currentOrderNo,
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
              orderNo: currentOrderNo,
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

    await this.recordStatusHistory(order, OrderStatus.PENDING_PAYMENT, undefined, now);
    order.statusHistory = this.fallbackStatusHistory(order);

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
      order.statusHistory = await this.fetchStatusHistory(order);
      order.riderDeliveryCount = await this.getOrderRiderDeliveryCount(order);
      order.deliveryProof = await this.fetchDeliveryProof(id);
      if (order.deliveryType === DeliveryType.DELIVERY) {
        order.deliveryConfirmRadiusM = await this.resolveShopDeliveryConfirmRadiusM(
          order.shopId,
        );
      }
      return this.ensureDeliveryCoordinates(order);
    }

    assertMemoryFallbackAllowed('OrderService');
    const order = memoryOrders.get(id);
    if (!order) throw new NotFoundException(`订单 ${id} 不存在`);
    order.statusHistory = await this.fetchStatusHistory(order);
    order.riderDeliveryCount = await this.getOrderRiderDeliveryCount(order);
    order.deliveryProof = memoryDeliveryProofs.get(id) || order.deliveryProof;
    if (order.deliveryType === DeliveryType.DELIVERY) {
      order.deliveryConfirmRadiusM = await this.resolveShopDeliveryConfirmRadiusM(
        order.shopId,
      );
    }
    return this.ensureDeliveryCoordinates(order);
  }

  private async getOrderRiderDeliveryCount(order: OrderRecord): Promise<number | undefined> {
    if (
      order.deliveryType !== DeliveryType.DELIVERY ||
      order.status !== OrderStatus.DELIVERING ||
      !order.riderId
    ) {
      return undefined;
    }
    try {
      return await this.countRiderActiveDeliveries(order.riderId);
    } catch (e) {
      this.logger.warn(
        `[Order] 查询骑手配送负载失败，跳过展示: ${e instanceof Error ? e.message : e}`,
      );
      return undefined;
    }
  }

  async countRiderActiveDeliveries(riderId: string): Promise<number> {
    if (!riderId) return 0;
    if (hasSupabase() && supabase) {
      const { count, error } = await supabase
        .from('tf_orders')
        .select('id', { count: 'exact', head: true })
        .eq('rider_id', riderId)
        .eq('delivery_type', DeliveryType.DELIVERY)
        .eq('status', OrderStatus.DELIVERING);
      if (error) {
        throw new BadRequestException(`查询骑手配送负载失败: ${error.message}`);
      }
      return count || 0;
    }

    assertMemoryFallbackAllowed('OrderService');
    return Array.from(memoryOrders.values()).filter(
      (o) =>
        o.riderId === riderId &&
        o.deliveryType === DeliveryType.DELIVERY &&
        o.status === OrderStatus.DELIVERING,
    ).length;
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
    let riderDeliveryCount: number | undefined;
    try {
      riderDeliveryCount = await this.countRiderActiveDeliveries(riderId);
    } catch (e) {
      this.logger.warn(
        `[Order] 查询骑手配送负载失败，轨迹继续上报: ${e instanceof Error ? e.message : e}`,
      );
    }
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
              riderDeliveryCount,
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
          riderDeliveryCount,
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
        riderDeliveryCount,
        latitude: point.latitude,
        longitude: point.longitude,
        recordedAt: point.recordedAt,
      });
    } catch (e) {
      this.logger.warn(e instanceof Error ? e.message : String(e));
    }
    return point;
  }

  /**
   * 取该骑手当前「配送中的外送订单」（精简查询，仅用于位置同步，不带订单项）。
   * 旧库缺 rider_id 列时降级到进程内抢单归属 memoryRiderClaims。
   */
  private async listRiderDeliveringOrders(riderId: string): Promise<OrderRecord[]> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_orders')
        .select('*')
        .eq('rider_id', riderId)
        .eq('delivery_type', DeliveryType.DELIVERY)
        .eq('status', OrderStatus.DELIVERING)
        .order('updated_at', { ascending: false })
        .limit(RIDER_LOCATION_MAX_ORDERS);
      if (error) {
        if (this.isMissingColumnError(error)) {
          this.logger.warn(
            `[Order] tf_orders 缺少 rider_id 列，降级内存抢单归属: ${error.message}`,
          );
          return this.listClaimedDeliveringOrders(riderId);
        }
        throw new BadRequestException(`查询配送中订单失败: ${error.message}`);
      }
      return (data || []).map((row) => this.toRecord(row));
    }

    assertMemoryFallbackAllowed('OrderService');
    return Array.from(memoryOrders.values()).filter(
      (o) =>
        (o.riderId === riderId || memoryRiderClaims.get(o.id) === riderId) &&
        o.deliveryType === DeliveryType.DELIVERY &&
        o.status === OrderStatus.DELIVERING,
    );
  }

  /** 旧库降级路径：按内存抢单归属逐单校验状态 */
  private async listClaimedDeliveringOrders(riderId: string): Promise<OrderRecord[]> {
    const claimedIds = Array.from(memoryRiderClaims.entries())
      .filter(([, claimedBy]) => claimedBy === riderId)
      .map(([orderId]) => orderId)
      .slice(0, RIDER_LOCATION_MAX_ORDERS);

    const orders: OrderRecord[] = [];
    for (const orderId of claimedIds) {
      try {
        const order = await this.findById(orderId);
        if (
          order.deliveryType === DeliveryType.DELIVERY &&
          order.status === OrderStatus.DELIVERING
        ) {
          orders.push(order);
        }
      } catch (e) {
        this.logger.warn(
          `[Order] 内存归属订单 ${orderId} 读取失败，跳过位置同步: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    return orders;
  }

  /**
   * 骑手无感定位：一次上报即同步到该骑手全部配送中订单。
   * 相比逐单调用 appendDeliveryTrackPoint，把「查单 + 落库」压到 2 次数据库往返，
   * 并复用同一 recordedAt，保证多单轨迹时间戳一致。
   */
  async reportRiderLocation(
    riderId: string,
    dto: DeliveryTrackPointDto,
  ): Promise<RiderLocationReportResult> {
    if (!riderId) {
      throw new BadRequestException('缺少骑手身份，无法上报位置');
    }

    const recordedAt = new Date().toISOString();
    const orders = await this.listRiderDeliveringOrders(riderId);
    if (orders.length === 0) {
      return { reported: 0, orderIds: [], recordedAt, riderDeliveryCount: 0 };
    }

    const riderDeliveryCount = orders.length;
    const entries = orders.map((order) => ({
      order,
      point: {
        id: uuidv4(),
        orderId: order.id,
        shopId: order.shopId,
        riderId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        speed: dto.speed,
        accuracy: dto.accuracy,
        source: dto.source || 'rider_auto',
        recordedAt,
        createdAt: recordedAt,
      } as DeliveryTrackPointRecord,
    }));

    let persisted = false;
    if (hasSupabase() && supabase) {
      const { error } = await supabase.from('tf_delivery_tracks').insert(
        entries.map(({ point }) => ({
          id: point.id,
          order_id: point.orderId,
          shop_id: point.shopId,
          rider_id: point.riderId,
          latitude: point.latitude,
          longitude: point.longitude,
          speed: point.speed ?? null,
          accuracy: point.accuracy ?? null,
          source: point.source,
          recorded_at: point.recordedAt,
          created_at: point.createdAt,
        })),
      );
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (
          msg.includes('tf_delivery_tracks') ||
          msg.includes('schema cache') ||
          msg.includes('does not exist')
        ) {
          this.logger.warn(`[Order] tf_delivery_tracks 不可用，降级内存轨迹: ${error.message}`);
        } else {
          throw new BadRequestException(`上报配送位置失败: ${error.message}`);
        }
      } else {
        persisted = true;
      }
    } else {
      assertMemoryFallbackAllowed('OrderService');
    }

    if (!persisted) {
      for (const { point } of entries) {
        const list = memoryDeliveryTracks.get(point.orderId) || [];
        list.push(point);
        memoryDeliveryTracks.set(point.orderId, list);
      }
    }

    // 逐单推送，商家房间与顾客私有房间都会收到（见 OrderGateway.emitDeliveryTrackUpdated）
    for (const { order, point } of entries) {
      try {
        this.orderGateway.emitDeliveryTrackUpdated({
          orderId: point.orderId,
          shopId: point.shopId,
          userId: order.userId,
          riderId: point.riderId,
          riderDeliveryCount,
          latitude: point.latitude,
          longitude: point.longitude,
          recordedAt: point.recordedAt,
        });
      } catch (e) {
        this.logger.warn(e instanceof Error ? e.message : String(e));
      }
    }

    return {
      reported: entries.length,
      orderIds: entries.map(({ point }) => point.orderId),
      recordedAt,
      riderDeliveryCount,
    };
  }

  async findByUserId(
    userId: string,
    page = 1,
    pageSize = 20,
    status?: string,
    keyword?: string,
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
      query = applyOrderStatusQueryFilter(query, status);
      query = applyOrderKeywordFilter(query, keyword);
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
    if (isCancelRequestPendingFilter(status)) {
      userOrders = userOrders.filter((o) => Boolean(o.cancelRequestedAt));
    } else if (isRefundStatusGroup(status)) {
      userOrders = userOrders.filter((o) => matchesRefundAfterSale(o));
    } else {
      const statusList = resolveStatusFilter(status);
      if (statusList?.length) {
        const set = new Set(statusList);
        userOrders = userOrders.filter((o) => set.has(o.status));
      }
    }
    // 内存分支关键词过滤
    if (keyword?.trim()) {
      const q = keyword.trim().toLowerCase();
      userOrders = userOrders.filter((o) =>
        (o.orderNo || '').toLowerCase().includes(q) ||
        (o.contactName || '').toLowerCase().includes(q) ||
        (o.contactPhone || '').toLowerCase().includes(q),
      );
    }
    return this.paginate(userOrders, page, pageSize);
  }

  async findByShopId(
    shopId?: string,
    status?: string,
    page = 1,
    pageSize = 20,
    isPool = false,
    keyword?: string,
  ): Promise<PaginatedData<OrderRecord>> {
    if (hasSupabase() && supabase) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from('tf_orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      // shopId 为空表示全店查询（平台管理员跨店视角）；否则按店过滤
      if (shopId) {
        query = query.eq('shop_id', shopId);
      }

      if (isPool) {
        // 抢单池：待取餐或已开始配送但还没有骑手认领的外送单
        query = query
          .eq('delivery_type', DeliveryType.DELIVERY)
          .is('rider_id', null)
          .in('status', [OrderStatus.READY_FOR_DELIVERY, OrderStatus.PREPARING, OrderStatus.DELIVERING]);
      } else {
        query = applyOrderStatusQueryFilter(query, status);
      }
      query = applyOrderKeywordFilter(query, keyword);

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
      .filter((o) => !shopId || o.shopId === shopId)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    if (isPool) {
      filtered = filtered.filter(o =>
        o.deliveryType === DeliveryType.DELIVERY &&
        !o.riderId &&
        (o.status === OrderStatus.READY_FOR_DELIVERY || o.status === OrderStatus.PREPARING || o.status === OrderStatus.DELIVERING),
      );
    } else if (isCancelRequestPendingFilter(status)) {
      filtered = filtered.filter((o) => Boolean(o.cancelRequestedAt));
    } else if (isRefundStatusGroup(status)) {
      filtered = filtered.filter((o) => matchesRefundAfterSale(o));
    } else {
      const statusList = resolveStatusFilter(status);
      if (statusList?.length) {
        const set = new Set(statusList);
        filtered = filtered.filter((o) => set.has(o.status));
      }
    }
    // 内存分支关键词过滤
    if (keyword?.trim()) {
      const q = keyword.trim().toLowerCase();
      filtered = filtered.filter((o) =>
        (o.orderNo || '').toLowerCase().includes(q) ||
        (o.contactName || '').toLowerCase().includes(q) ||
        (o.contactPhone || '').toLowerCase().includes(q),
      );
    }
    return this.paginate(filtered, page, pageSize);
  }


  /**
   * 骑手跨店抢单池：所有店铺待配送且无骑手的外送单
   */
  async findDeliveryPool(
    page = 1,
    pageSize = 20,
    shopId?: string,
    keyword?: string,
  ): Promise<PaginatedData<OrderRecord>> {
    if (hasSupabase() && supabase) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from('tf_orders')
        .select('*', { count: 'exact' })
        .eq('delivery_type', DeliveryType.DELIVERY)
        .is('rider_id', null)
        .in('status', [OrderStatus.READY_FOR_DELIVERY, OrderStatus.PREPARING, OrderStatus.DELIVERING])
        .order('created_at', { ascending: false })
        .range(from, to);
      if (shopId) {
        query = query.eq('shop_id', shopId);
      }
      query = applyOrderKeywordFilter(query, keyword);

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
          (
            o.status === OrderStatus.READY_FOR_DELIVERY ||
            o.status === OrderStatus.PREPARING ||
            o.status === OrderStatus.DELIVERING
          ) &&
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
    keyword?: string,
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
      query = applyOrderKeywordFilter(query, keyword);
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
    // 内存分支关键词过滤
    if (keyword?.trim()) {
      const q = keyword.trim().toLowerCase();
      const keywordFiltered = filtered.filter((o) =>
        (o.orderNo || '').toLowerCase().includes(q) ||
        (o.contactName || '').toLowerCase().includes(q) ||
        (o.contactPhone || '').toLowerCase().includes(q),
      );
      return this.paginate(status ? keywordFiltered.filter(o => o.status === status) : keywordFiltered, page, pageSize);
    }
    return this.paginate(status ? filtered.filter(o => o.status === status) : filtered, page, pageSize);
  }

  /**
   * 按作用域聚合各状态订单数量（单条 SQL / 一次内存遍历）。
   * scopeType: user | shop | rider | pool
   * scopeId: user_id / shop_id / rider_id；shop 为空表示全店，pool 可空
   */
  async countOrdersByScope(
    scopeType: 'user' | 'shop' | 'rider' | 'pool',
    scopeId?: string,
    keyword?: string,
  ): Promise<OrderStatusCounts> {
    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase.rpc('count_orders_by_scope', {
          p_scope_type: scopeType,
          p_scope_id: scopeId || null,
          p_keyword: keyword || null,
        });
        if (!error && data && Array.isArray(data) && data.length > 0) {
          const row = data[0];
          return this.normalizeCounts(row);
        }
        if (error) {
          this.logger.warn(`[Order] count_orders_by_scope RPC 失败: ${error.message}`);
        }
      } catch (e) {
        this.logger.warn(
          `[Order] count_orders_by_scope 异常: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    // 内存兜底 / RPC 不可用时的本地聚合
    assertMemoryFallbackAllowed('OrderService');
    const q = keyword?.trim().toLowerCase();
    const filtered = Array.from(memoryOrders.values()).filter((o) => {
      if (scopeType === 'user' && o.userId !== scopeId) return false;
      if (scopeType === 'shop' && scopeId && o.shopId !== scopeId) return false;
      if (scopeType === 'rider' && o.riderId !== scopeId) return false;
      if (scopeType === 'pool') {
        if (o.deliveryType !== DeliveryType.DELIVERY) return false;
        if (o.riderId) return false;
        if (![OrderStatus.READY_FOR_DELIVERY, OrderStatus.PREPARING, OrderStatus.DELIVERING].includes(o.status)) return false;
        if (scopeId && o.shopId !== scopeId) return false;
      }
      if (!q) return true;
      return (
        (o.orderNo || '').toLowerCase().includes(q) ||
        (o.contactName || '').toLowerCase().includes(q) ||
        (o.contactPhone || '').toLowerCase().includes(q)
      );
    });

    return this.computeCounts(filtered);
  }

  emptyCounts(): OrderStatusCounts {
    return {
      all: 0,
      pending_payment: 0,
      paid: 0,
      accepted: 0,
      preparing: 0,
      ready_for_delivery: 0,
      ready_for_pickup: 0,
      delivering: 0,
      refund: 0,
      completed: 0,
    };
  }

  private normalizeCounts(row: Record<string, unknown>): OrderStatusCounts {
    const n = (v: unknown) => (typeof v === 'number' ? v : parseInt(String(v || '0'), 10)) || 0;
    return {
      all: n(row.all_count ?? row.all),
      pending_payment: n(row.pending_payment),
      paid: n(row.paid),
      accepted: n(row.accepted),
      preparing: n(row.preparing),
      ready_for_delivery: n(row.ready_for_delivery),
      ready_for_pickup: n(row.ready_for_pickup),
      delivering: n(row.delivering),
      refund: n(row.refund),
      completed: n(row.completed),
    };
  }

  private computeCounts(orders: OrderRecord[]): OrderStatusCounts {
    const c: OrderStatusCounts = {
      all: orders.length,
      pending_payment: 0,
      paid: 0,
      accepted: 0,
      preparing: 0,
      ready_for_delivery: 0,
      ready_for_pickup: 0,
      delivering: 0,
      refund: 0,
      completed: 0,
    };
    for (const o of orders) {
      switch (o.status) {
        case OrderStatus.PENDING_PAYMENT:
          c.pending_payment++;
          break;
        case OrderStatus.PAID:
          c.paid++;
          break;
        case OrderStatus.ACCEPTED:
          c.accepted++;
          break;
        case OrderStatus.PREPARING:
          c.preparing++;
          break;
        case OrderStatus.READY_FOR_DELIVERY:
          c.ready_for_delivery++;
          break;
        case OrderStatus.READY_FOR_PICKUP:
          c.ready_for_pickup++;
          break;
        case OrderStatus.DELIVERING:
          c.delivering++;
          break;
        case OrderStatus.COMPLETED:
          c.completed++;
          break;
        case OrderStatus.CANCELLED:
        case OrderStatus.REJECTED:
          c.refund++;
          break;
      }
      if (o.cancelRequestedAt && o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.REJECTED) {
        c.refund++;
      }
    }
    return c;
  }


  /** 将订单有效支付记录标记为已退款（兼容历史 success 与规范 paid） */
  private async markPaymentsRefunded(orderId: string): Promise<void> {
    if (!hasSupabase() || !supabase) return;
    try {
      const { error } = await supabase
        .from('tf_payments')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .in('status', ['success', 'paid']);
      if (error) {
        this.logger.warn(`[Order] 标记退款失败 order=${orderId}: ${error.message}`);
      }
    } catch (e) {
      this.logger.warn(
        `[Order] 标记退款异常 order=${orderId}: ${e instanceof Error ? e.message : e}`,
      );
    }
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
        this.assertDeliveryTypeStatus(order, dto.status);
        // 外卖配送中不可普通改 completed：须骑手 deliver 或 force-complete
        if (
          order.deliveryType === DeliveryType.DELIVERY &&
          order.status === OrderStatus.DELIVERING &&
          dto.status === OrderStatus.COMPLETED
        ) {
          throw new BadRequestException(
            '外卖配送中订单请由骑手确认送达，或使用强制完成并填写原因',
          );
        }

        const previousStatus = order.status;
        const etaExtra = this.buildEstimatedCompletionExtra(previousStatus, dto);
        const reasonExtra =
          dto.status === OrderStatus.REJECTED
            ? { reject_reason: reason }
            : dto.status === OrderStatus.CANCELLED
              ? { cancel_reason: reason, cancel_requested_at: null, cancel_request_reason: null }
              : {};
        const extraFields = { ...reasonExtra, ...etaExtra };

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
            extraFields,
          );
          this.applyEstimatedCompletionLocal(updated, etaExtra);
          if (
            dto.status === OrderStatus.REJECTED ||
            dto.status === OrderStatus.CANCELLED
          ) {
            await this.markPaymentsRefunded(id);
          }
          this.emitStatusEvents(updated, previousStatus);
          return updated;
        }

        if (Object.keys(extraFields).length > 0) {
          try {
            await supabase
              .from('tf_orders')
              .update({ ...extraFields, updated_at: new Date().toISOString() })
              .eq('id', id);
          } catch (e) {
            this.logger.warn(
              `[Order] 写入状态附加字段失败: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        order.status = dto.status;
        if (dto.status === OrderStatus.REJECTED) order.rejectReason = reason;
        if (dto.status === OrderStatus.CANCELLED) order.cancelReason = reason;
        this.applyEstimatedCompletionLocal(order, etaExtra);
        order.updatedAt = new Date().toISOString();
        await this.recordStatusHistory(order, dto.status, previousStatus, order.updatedAt);
        order.statusHistory = await this.fetchStatusHistory(order);
        if (
          dto.status === OrderStatus.REJECTED ||
          dto.status === OrderStatus.CANCELLED
        ) {
          await this.markPaymentsRefunded(id);
        }
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
      this.assertDeliveryTypeStatus(order, dto.status);
        // 外卖配送中不可普通改 completed：须骑手 deliver 或 force-complete
        if (
          order.deliveryType === DeliveryType.DELIVERY &&
          order.status === OrderStatus.DELIVERING &&
          dto.status === OrderStatus.COMPLETED
        ) {
          throw new BadRequestException(
            '外卖配送中订单请由骑手确认送达，或使用强制完成并填写原因',
          );
        }

      const previousStatus = order.status;
      const etaExtra = this.buildEstimatedCompletionExtra(previousStatus, dto);
      order.status = dto.status;
      if (dto.status === OrderStatus.REJECTED) order.rejectReason = reason;
      if (dto.status === OrderStatus.CANCELLED) {
        order.cancelReason = reason;
        order.cancelRequestedAt = undefined;
        order.cancelRequestReason = undefined;
      }
      this.applyEstimatedCompletionLocal(order, etaExtra);
      order.updatedAt = new Date().toISOString();
      memoryOrders.set(id, order);
      await this.recordStatusHistory(order, dto.status, previousStatus, order.updatedAt);
      order.statusHistory = await this.fetchStatusHistory(order);
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
    const cancellable = userId ? CUSTOMER_CANCELLABLE : MERCHANT_CANCELLABLE;
    if (!cancellable.has(order.status)) {
      throw new BadRequestException(`订单状态为 ${order.status}，不允许取消`);
    }
    const cancelReason = reason?.trim();
    if (!cancelReason) {
      throw new BadRequestException('取消原因不能为空');
    }

    const previousStatus = order.status;
    // 商家接单后关单：旧版 atomic_cancel_order 仅允许 pending/paid，走直更+退款更稳
    const useLegacyDirectCancel =
      !userId &&
      ![OrderStatus.PENDING_PAYMENT, OrderStatus.PAID].includes(previousStatus);

    if (hasSupabase() && supabase) {
      if (!useLegacyDirectCancel) {
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
          { cancel_reason: cancelReason, cancel_requested_at: null, cancel_request_reason: null },
        );
        await this.markPaymentsRefunded(id);
        try {
          this.orderGateway.emitOrderUpdated(updated, previousStatus);
        } catch (e) {
          this.logger.warn(e instanceof Error ? e.message : String(e));
        }
        return updated;
      }
      } else {
        // 接单后商家取消：直更状态 + 支付退款
        await this.markPaymentsRefunded(id);
        const updated = await this.updateOrderStatusDirect(
          id,
          previousStatus,
          OrderStatus.CANCELLED,
          {
            cancel_reason: cancelReason,
            cancel_requested_at: null,
            cancel_request_reason: null,
          },
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

      // RPC 可能仍只认历史 success；再兜底一次兼容 paid
      await this.markPaymentsRefunded(id);

      order.status = OrderStatus.CANCELLED;
      order.cancelReason = cancelReason;
      order.updatedAt = new Date().toISOString();
      await this.recordStatusHistory(order, OrderStatus.CANCELLED, previousStatus, order.updatedAt);
      order.statusHistory = await this.fetchStatusHistory(order);
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
    // 主路径：ready_for_delivery；兼容旧 preparing/无骑手 delivering
    if (
      ![
        OrderStatus.READY_FOR_DELIVERY,
        OrderStatus.PREPARING,
        OrderStatus.DELIVERING,
      ].includes(order.status)
    ) {
      throw new BadRequestException('当前订单状态不可抢单');
    }
    if (order.riderId) {
      throw new BadRequestException('订单已被抢走');
    }

    const previousStatus = order.status;
    const now = new Date().toISOString();

    if (hasSupabase() && supabase) {
      // 使用原子操作确保只有一个骑手能成功抢单
      let { data, error } = await supabase
        .from('tf_orders')
        .update({
          rider_id: riderId,
          status: OrderStatus.DELIVERING,
          updated_at: now,
        })
        .eq('id', id)
        .eq('status', previousStatus)
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
            updated_at: now,
          })
          .eq('id', id)
          .eq('status', previousStatus)
          .select()
          .maybeSingle());
      }

      if (error) throw new BadRequestException(`抢单失败: ${error.message}`);
      if (!data) throw new BadRequestException('订单已被抢走');
    } else {
      assertMemoryFallbackAllowed('OrderService');
      order.riderId = riderId;
      order.status = OrderStatus.DELIVERING;
      order.updatedAt = now;
      memoryOrders.set(id, order);
    }

    // 无论 DB 是否有 rider_id，都记录进程内归属，便于 deliver 校验
    memoryRiderClaims.set(id, riderId);
    await this.recordStatusHistory(order, OrderStatus.DELIVERING, previousStatus, now);

    const updatedOrder = await this.findById(id);
    if (!updatedOrder.riderId) {
      updatedOrder.riderId = riderId;
    }
    try {
      this.orderGateway.emitOrderUpdated(updatedOrder, previousStatus);
    } catch (e) { this.logger.warn(e instanceof Error ? e.message : String(e)); }

    // 商家语音播报：骑手已接单 / 到店取餐出发
    void this.notifyShopStaff({
      shopId: updatedOrder.shopId,
      type: 'rider_assigned',
      title: '骑手已接单',
      content: `外卖订单 ${this.formatOrderLabel(updatedOrder)} 骑手已接单取餐，正在配送途中`,
      relatedId: updatedOrder.id,
    });

    return updatedOrder;
  }


  private async resolveShopDeliveryConfirmRadiusM(shopId: string): Promise<number> {
    try {
      const shop = await this.shopService.findById(shopId);
      const raw = (shop as any)?.deliveryConfirmRadiusM;
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.min(
          DELIVERY_CONFIRM_RADIUS_MAX_M,
          Math.max(DELIVERY_CONFIRM_RADIUS_MIN_M, Math.round(raw)),
        );
      }
    } catch (e) {
      this.logger.warn(
        `[Order] 读取店铺送达围栏失败，使用默认 ${DELIVERY_CONFIRM_RADIUS_M}m: ${
          e instanceof Error ? e.message : e
        }`,
      );
    }
    return DELIVERY_CONFIRM_RADIUS_M;
  }

  /**
   * 骑手确认送达
   * - 仅外送单：必须在收货地址地理围栏内（默认 500m + 精度缓冲）
   * - 必须上传 1~3 张送达现场照片
   * - 凭证写入 tf_delivery_info，顾客/商家/骑手订单详情可见
   */
  async deliverOrder(
    id: string,
    riderId: string,
    dto: DeliverOrderDto,
  ): Promise<OrderRecord> {
    const order = await this.findById(id);
    const claimedRiderId = order.riderId || memoryRiderClaims.get(id);
    // 有 rider 归属时校验本人；旧库缺 rider_id 且无内存归属时，允许当前骑手完成（演示兼容）
    if (claimedRiderId && claimedRiderId !== riderId) {
      throw new BadRequestException('非本人订单，无权操作');
    }
    if (order.status !== OrderStatus.DELIVERING) {
      throw new BadRequestException('订单不在配送中');
    }
    if (order.deliveryType !== DeliveryType.DELIVERY) {
      throw new BadRequestException('仅外卖配送订单需要骑手确认送达');
    }

    const photoUrls = (dto.photoUrls || [])
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter(Boolean);
    if (photoUrls.length < DELIVERY_PROOF_MIN_PHOTOS) {
      throw new BadRequestException(
        `请至少上传 ${DELIVERY_PROOF_MIN_PHOTOS} 张送达现场照片`,
      );
    }
    if (photoUrls.length > DELIVERY_PROOF_MAX_PHOTOS) {
      throw new BadRequestException(
        `送达照片最多 ${DELIVERY_PROOF_MAX_PHOTOS} 张`,
      );
    }
    for (const url of photoUrls) {
      if (!this.isAllowedProofPhotoUrl(url)) {
        throw new BadRequestException('送达照片地址无效，请重新上传');
      }
    }

    const riderPoint = normalizeGeoPoint(dto.latitude, dto.longitude);
    if (!riderPoint) {
      throw new BadRequestException('定位无效，请开启定位后重试');
    }

    const withCoords = await this.ensureDeliveryCoordinates(order);
    const destination = normalizeGeoPoint(
      withCoords.deliveryLatitude,
      withCoords.deliveryLongitude,
    );
    if (!destination || !isValidGeoPoint(destination)) {
      throw new BadRequestException(
        '订单缺少收货坐标，无法校验送达位置。请联系顾客确认地址后重试',
      );
    }

    const distanceM = Math.round(
      haversineDistanceMeters(riderPoint, destination),
    );
    const baseRadiusM = await this.resolveShopDeliveryConfirmRadiusM(order.shopId);
    const radiusM = resolveDeliveryConfirmRadiusM({
      baseRadiusM,
      accuracyM: dto.accuracy,
      minM: DELIVERY_CONFIRM_RADIUS_MIN_M,
      maxM: DELIVERY_CONFIRM_RADIUS_MAX_M,
      accuracyBufferMaxM: DELIVERY_CONFIRM_ACCURACY_BUFFER_MAX_M,
    });

    if (distanceM > radiusM) {
      throw new BadRequestException(
        `当前位置距收货地址约 ${distanceM} 米，超出 ${radiusM} 米送达范围，请靠近后再确认`,
      );
    }

    const now = new Date().toISOString();
    const proof: DeliveryProofRecord = {
      photos: photoUrls.map((url) => ({ url, uploadedAt: now })),
      deliveredAt: now,
      confirmLatitude: riderPoint.latitude,
      confirmLongitude: riderPoint.longitude,
      confirmAccuracy:
        typeof dto.accuracy === 'number' && Number.isFinite(dto.accuracy)
          ? dto.accuracy
          : undefined,
      confirmDistanceM: distanceM,
      confirmRadiusM: radiusM,
      riderId,
      confirmSource: 'rider',
    };

    await this.upsertDeliveryProof(order, proof);

    const completed = await this.completeOrderInternal(id, OrderStatus.DELIVERING);
    completed.deliveryProof = proof;
    memoryDeliveryProofs.set(id, proof);
    memoryRiderClaims.delete(id);
    return completed;
  }


  /**
   * 商家/管理员强制完成外卖配送单（跳过围栏与拍照，必须写原因，记入送达凭证）
   */
  /** T246.3: 顾客自取/堂食自助确认取餐（ready_for_pickup → completed） */
  async customerCompletePickup(id: string, userId: string): Promise<OrderRecord> {
    const order = await this.findById(id);
    if (order.userId !== userId) {
      throw new ForbiddenException('只能确认自己的订单取餐');
    }
    if (order.deliveryType === DeliveryType.DELIVERY) {
      throw new BadRequestException('外卖订单请在配送完成后确认签收');
    }
    if (order.status !== OrderStatus.READY_FOR_PICKUP) {
      throw new BadRequestException('仅待取餐订单可确认取餐');
    }
    const completed = await this.completeOrderInternal(id, OrderStatus.READY_FOR_PICKUP);
    this.logger.log(`[Order] 顾客自确认取餐完成 orderId=${id} userId=${userId}`);
    return completed;
  }

  /**
   * §3.23 / T246.7 商家到店核销：扫码或输入订单 ID 后一键推进 `ready_for_pickup → completed`。
   *
   * 设计要点：
   * - 仅 `pickup` / `dine_in`（不允许核销外卖单，避免误操作进入未达成的 completed）
   * - 仅允许 `ready_for_pickup` 状态推进（不允许 `paid/preparing` 提前核销）
   * - 已完成订单二次核销视为业务幂等失败，返回 409（前端可忽略）
   * - 多租户校验：商家订单必须属于当前商家店铺（纵深防御，controller 已通过 assertCanAccessOrder）
   * - 不引入核销 token：扫码内容是订单 ID，安全靠接口侧权限 + 店铺归属双校验，与既有 `/orders/:id/cancel` 一致
   */
  async merchantVerifyPickup(
    id: string,
    operator: { userId: string; shopId?: string; role: string },
  ): Promise<OrderRecord> {
    const order = await this.findById(id);
    if (order.deliveryType === DeliveryType.DELIVERY) {
      throw new BadRequestException('外卖订单不支持到店核销，请走配送完成流程');
    }
    if (order.deliveryType !== DeliveryType.PICKUP && order.deliveryType !== DeliveryType.DINE_IN) {
      // 上方已排除 delivery；保留分支以兼容未来枚举新增
      throw new BadRequestException('仅到店自取/堂食订单支持核销');
    }
    if (operator.shopId && order.shopId !== operator.shopId) {
      throw new ForbiddenException('只能核销本店铺的订单');
    }
    if (order.status === OrderStatus.COMPLETED) {
      throw new ConflictException('订单已完成，无需重复核销');
    }
    if (order.status !== OrderStatus.READY_FOR_PICKUP) {
      throw new BadRequestException(
        `仅待取餐订单可核销，当前状态：${order.status}`,
      );
    }
    const completed = await this.completeOrderInternal(id, OrderStatus.READY_FOR_PICKUP);
    this.logger.log(
      `[Order] 商家到店核销完成 orderId=${id} shopId=${order.shopId} merchant=${operator.userId}`,
    );
    return completed;
  }

  async forceCompleteOrder(
    id: string,
    operator: { userId: string; role: string },
    reason: string,
  ): Promise<OrderRecord> {
    const forceReason = (reason || '').trim();
    if (forceReason.length < 2) {
      throw new BadRequestException('强制完成原因至少 2 个字');
    }
    const order = await this.findById(id);
    if (order.deliveryType !== DeliveryType.DELIVERY) {
      throw new BadRequestException('仅外卖配送订单支持强制完成');
    }
    if (order.status !== OrderStatus.DELIVERING) {
      throw new BadRequestException('仅配送中的外卖订单可强制完成');
    }

    const now = new Date().toISOString();
    const source =
      operator.role === 'admin' || operator.role === 'ADMIN'
        ? 'admin_force'
        : 'merchant_force';
    const radiusM = await this.resolveShopDeliveryConfirmRadiusM(order.shopId);
    const proof: DeliveryProofRecord = {
      photos: [],
      deliveredAt: now,
      confirmDistanceM: undefined,
      confirmRadiusM: radiusM,
      riderId: order.riderId,
      confirmSource: source,
      forceReason,
    };
    await this.upsertDeliveryProof(order, proof);

    // 直接走状态更新内部路径：先临时绕过 guard —— 使用 updateOrderStatusDirect 风格
    // 通过私有标记：调用 updateStatus 会被 guard 拦截，故用 completed via internal
    const completed = await this.completeOrderInternal(id, order.status as OrderStatus);
    completed.deliveryProof = proof;
    memoryDeliveryProofs.set(id, proof);
    memoryRiderClaims.delete(id);
    this.logger.log(
      `[Order] 强制完成 orderId=${id} by ${operator.role}/${operator.userId} reason=${forceReason}`,
    );
    return completed;
  }

  /** 内部完成订单（供骑手送达 / 强制完成），不走外卖 completed guard */
  private async completeOrderInternal(
    id: string,
    fromStatus: OrderStatus,
  ): Promise<OrderRecord> {
    if (hasSupabase() && supabase) {
      const { error: rpcErr } = await supabase.rpc('atomic_update_order_status', {
        p_order_id: id,
        p_from_status: fromStatus,
        p_to_status: OrderStatus.COMPLETED,
      });
      if (rpcErr) {
        if (!this.isMissingRpcError(rpcErr)) {
          throw new BadRequestException(`完成订单失败: ${rpcErr.message}`);
        }
        this.logger.warn(
          `[Order] atomic_update_order_status 不可用，降级直更: ${rpcErr.message}`,
        );
        const updated = await this.updateOrderStatusDirect(
          id,
          fromStatus,
          OrderStatus.COMPLETED,
        );
        this.emitStatusEvents(updated, fromStatus);
        return updated;
      }
      const order = await this.findById(id);
      // findById 会再次读 proof；状态可能已是 completed
      if (order.status !== OrderStatus.COMPLETED) {
        // RPC 成功但读到旧缓存极少见；再直更一次
        const updated = await this.updateOrderStatusDirect(
          id,
          fromStatus,
          OrderStatus.COMPLETED,
        );
        this.emitStatusEvents(updated, fromStatus);
        return updated;
      }
      await this.recordStatusHistory(
        order,
        OrderStatus.COMPLETED,
        fromStatus,
        order.updatedAt,
      );
      order.statusHistory = await this.fetchStatusHistory(order);
      this.emitStatusEvents(order, fromStatus);
      return order;
    }

    assertMemoryFallbackAllowed('OrderService.completeOrderInternal');
    const order = memoryOrders.get(id);
    if (!order) throw new NotFoundException(`订单 ${id} 不存在`);
    const previousStatus = order.status;
    order.status = OrderStatus.COMPLETED;
    order.updatedAt = new Date().toISOString();
    memoryOrders.set(id, order);
    await this.recordStatusHistory(order, OrderStatus.COMPLETED, previousStatus, order.updatedAt);
    order.statusHistory = await this.fetchStatusHistory(order);
    this.emitStatusEvents(order, previousStatus);
    return order;
  }

  private isAllowedProofPhotoUrl(url: string): boolean {
    if (!url || url.length > 2048) return false;
    if (url.startsWith('memory://')) return true;
    if (url.startsWith('https://') || url.startsWith('http://')) return true;
    return false;
  }

  private async fetchDeliveryProof(
    orderId: string,
  ): Promise<DeliveryProofRecord | undefined> {
    if (memoryDeliveryProofs.has(orderId)) {
      return memoryDeliveryProofs.get(orderId);
    }
    if (!hasSupabase() || !supabase) {
      return undefined;
    }
    try {
      const { data, error } = await supabase
        .from('tf_delivery_info')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      if (error) {
        const msg = error.message || '';
        if (
          msg.includes('tf_delivery_info') ||
          msg.includes('proof_photos') ||
          msg.includes('schema cache') ||
          msg.includes('does not exist')
        ) {
          this.logger.warn(
            `[Order] tf_delivery_info 读取失败，跳过送达凭证: ${error.message}`,
          );
          return undefined;
        }
        this.logger.warn(`[Order] 查询送达凭证失败: ${error.message}`);
        return undefined;
      }
      if (!data) return undefined;
      const photosRaw = (data as any).proof_photos;
      const photos = Array.isArray(photosRaw)
        ? photosRaw
            .map((p: any) => ({
              url: String(p?.url || ''),
              path: p?.path ? String(p.path) : undefined,
              uploadedAt: p?.uploadedAt ? String(p.uploadedAt) : undefined,
            }))
            .filter((p: { url: string }) => !!p.url)
        : [];
      if (
        photos.length === 0 &&
        !(data as any).delivered_at &&
        !(data as any).confirm_latitude
      ) {
        return undefined;
      }
      const point = normalizeGeoPoint(
        (data as any).confirm_latitude,
        (data as any).confirm_longitude,
      );
      const proof: DeliveryProofRecord = {
        photos,
        deliveredAt: (data as any).delivered_at || (data as any).updated_at,
        confirmLatitude: point?.latitude ?? 0,
        confirmLongitude: point?.longitude ?? 0,
        confirmAccuracy:
          (data as any).confirm_accuracy != null
            ? Number((data as any).confirm_accuracy)
            : undefined,
        confirmDistanceM: Number((data as any).confirm_distance_m || 0),
        confirmRadiusM: Number(
          (data as any).confirm_radius_m || DELIVERY_CONFIRM_RADIUS_M,
        ),
        riderId: (data as any).rider_id || undefined,
        courierName: (data as any).courier_name || undefined,
        courierPhone: (data as any).courier_phone || undefined,
        confirmSource: (data as any).confirm_source || undefined,
        forceReason: (data as any).force_reason || undefined,
      };
      memoryDeliveryProofs.set(orderId, proof);
      return proof;
    } catch (e) {
      this.logger.warn(
        `[Order] 查询送达凭证异常: ${e instanceof Error ? e.message : e}`,
      );
      return undefined;
    }
  }

  private async upsertDeliveryProof(
    order: OrderRecord,
    proof: DeliveryProofRecord,
  ): Promise<void> {
    memoryDeliveryProofs.set(order.id, proof);

    if (!hasSupabase() || !supabase) {
      assertMemoryFallbackAllowed('OrderService.upsertDeliveryProof');
      return;
    }

    const row = {
      order_id: order.id,
      shop_id: order.shopId,
      rider_id: proof.riderId || null,
      proof_photos: proof.photos,
      confirm_latitude: proof.confirmLatitude ?? null,
      confirm_longitude: proof.confirmLongitude ?? null,
      confirm_accuracy: proof.confirmAccuracy ?? null,
      confirm_distance_m: proof.confirmDistanceM ?? null,
      confirm_radius_m: proof.confirmRadiusM ?? null,
      confirm_source: proof.confirmSource || 'rider',
      force_reason: proof.forceReason || null,
      delivered_at: proof.deliveredAt,
      updated_at: proof.deliveredAt,
    };

    try {
      const { data: existing, error: findErr } = await supabase
        .from('tf_delivery_info')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle();
      if (findErr) {
        throw findErr;
      }
      if (existing?.id) {
        const { error } = await supabase
          .from('tf_delivery_info')
          .update(row)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tf_delivery_info').insert({
          ...row,
          created_at: proof.deliveredAt,
        });
        if (error) throw error;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes('tf_delivery_info') ||
        msg.includes('proof_photos') ||
        msg.includes('schema cache') ||
        msg.includes('does not exist')
      ) {
        this.logger.warn(
          `[Order] tf_delivery_info 不可用，送达凭证仅内存保存: ${msg}`,
        );
        assertMemoryFallbackAllowed('OrderService.upsertDeliveryProof');
        return;
      }
      throw new BadRequestException(`保存送达凭证失败: ${msg}`);
    }
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
    if (order.status === OrderStatus.PAID) {
      await this.recordStatusHistory(order, OrderStatus.PAID, previousStatus, order.updatedAt);
      order.statusHistory = await this.fetchStatusHistory(order);
    }
    this.emitStatusEvents(order, previousStatus);
    return order;
  }

  /** 状态变更统一推送：updated + paid 时额外 order:new/order:paid */
  private emitStatusEvents(order: OrderRecord, previousStatus: OrderStatus | string): void {
    try {
      this.orderGateway.emitOrderUpdated(order, String(previousStatus));
      if (order.status === OrderStatus.PAID) {
        this.orderGateway.emitOrderNew(order, String(previousStatus));
        // 仅「待支付 → 已支付」写站内消息，避免重复推送
        if (String(previousStatus) === OrderStatus.PENDING_PAYMENT) {
          void this.notifyShopStaffPaidOrder(order);
        }
      }
      // T246.6 备餐完成 → 待取餐：提醒顾客到店取餐（同状态重复写入时跳过）
      if (
        order.status === OrderStatus.READY_FOR_PICKUP &&
        String(previousStatus) !== OrderStatus.READY_FOR_PICKUP
      ) {
        void this.notifyCustomerReadyForPickup(order);
      }
    } catch (e) {
      this.logger.warn(
        `[emitStatusEvents] 推送失败 orderId=${order.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private formatOrderLabel(order: Pick<OrderRecord, 'id' | 'orderNo'>): string {
    return order.orderNo || order.id.slice(-8).toUpperCase();
  }

  private formatAmountYuan(totalFen: number): string {
    return `¥${(Number(totalFen || 0) / 100).toFixed(2)}`;
  }

  /** 解析店铺商家/店员账号（tf_users + tf_user_roles） */
  private async resolveShopStaffUserIds(shopId: string): Promise<string[]> {
    if (!shopId) return [];
    const ids = new Set<string>();
    if (hasSupabase() && supabase) {
      try {
        const { data: users, error: userErr } = await supabase
          .from('tf_users')
          .select('id')
          .eq('shop_id', shopId)
          .in('role', ['merchant', 'admin']);
        if (userErr) {
          this.logger.warn(`[Order] 查询店铺用户失败: ${userErr.message}`);
        } else {
          for (const row of users || []) {
            if (row?.id) ids.add(String(row.id));
          }
        }
        const { data: roles, error: roleErr } = await supabase
          .from('tf_user_roles')
          .select('user_id')
          .eq('shop_id', shopId)
          .eq('status', 'active')
          .in('role', ['merchant', 'admin']);
        if (roleErr) {
          if (this.isMissingColumnError(roleErr)) {
            const { data: roles2 } = await supabase
              .from('tf_user_roles')
              .select('user_id')
              .eq('shop_id', shopId)
              .in('role', ['merchant', 'admin']);
            for (const row of roles2 || []) {
              if (row?.user_id) ids.add(String(row.user_id));
            }
          } else {
            this.logger.warn(`[Order] 查询店铺角色失败: ${roleErr.message}`);
          }
        } else {
          for (const row of roles || []) {
            if (row?.user_id) ids.add(String(row.user_id));
          }
        }
      } catch (e) {
        this.logger.warn(
          `[Order] resolveShopStaffUserIds 异常: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    return Array.from(ids);
  }

  /** 向店铺全体商家/管理员推送站内消息（亦供评价等其它模块复用） */
  async notifyShopStaff(input: {
    shopId: string;
    type: string;
    title: string;
    content: string;
    relatedId: string;
  }): Promise<void> {
    try {
      const userIds = await this.resolveShopStaffUserIds(input.shopId);
      if (!userIds.length) {
        this.logger.debug(`[Order] 店铺 ${input.shopId} 无商家账号，跳过站内消息 ${input.type}`);
        return;
      }
      await Promise.all(
        userIds.map((userId) =>
          this.inboxService
            .create({
              userId,
              type: input.type,
              title: input.title,
              content: input.content,
              relatedType: 'order',
              relatedId: input.relatedId,
            })
            .catch((e) => {
              this.logger.warn(
                `[Order] 站内消息失败 user=${userId}: ${e instanceof Error ? e.message : e}`,
              );
            }),
        ),
      );
    } catch (e) {
      this.logger.warn(
        `[Order] notifyShopStaff 失败: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  private async notifyShopStaffPaidOrder(order: OrderRecord): Promise<void> {
    const label = this.formatOrderLabel(order);
    const amount = this.formatAmountYuan(order.total);
    const delivery =
      order.deliveryType === DeliveryType.DELIVERY
        ? '外卖'
        : order.deliveryType === DeliveryType.DINE_IN
          ? '堂食'
          : '自取';
    await this.notifyShopStaff({
      shopId: order.shopId,
      type: 'order_paid',
      title: '新订单待接单',
      content: `顾客已支付 ${amount}（${delivery}），订单 ${label}，请尽快接单`,
      relatedId: order.id,
    });
  }

  private async notifyShopStaffCancelRequest(order: OrderRecord): Promise<void> {
    const label = this.formatOrderLabel(order);
    const amount = this.formatAmountYuan(order.total);
    const reason = (order.cancelRequestReason || '').trim();
    await this.notifyShopStaff({
      shopId: order.shopId,
      type: 'order_cancel_request',
      title: '售后待处理：取消申请',
      content: reason
        ? `订单 ${label}（${amount}）顾客申请取消：${reason}`
        : `订单 ${label}（${amount}）顾客申请取消，请尽快处理`,
      relatedId: order.id,
    });
  }

  /**
   * T246.6 餐品备好通知顾客到店取餐（自取/堂食）。
   * 站内消息为主，微信订阅消息依赖模板 ID 配置，暂不发送（T304 显式暂缓：
   * 订阅消息能力为预留接口，待企业主体认证 T43 完成后再接线）。
   */
  private async notifyCustomerReadyForPickup(order: OrderRecord): Promise<void> {
    if (!order.userId) return;
    try {
      const label = this.formatOrderLabel(order);
      const isDineIn = order.deliveryType === DeliveryType.DINE_IN;
      const content = isDineIn
        ? `堂食订单 ${label} 已出餐${order.tableNo ? `，桌号 ${order.tableNo}` : ''}，请稍候上餐`
        : `自取订单 ${label} 已出餐，请到店向店员扫码核销`;
      await this.inboxService.create({
        userId: order.userId,
        type: 'order_ready_for_pickup',
        title: isDineIn ? '您的餐品已备好' : '您的餐品已备好，请到店取餐',
        content,
        relatedType: 'order',
        relatedId: order.id,
      });
    } catch (e) {
      this.logger.warn(
        `[Order] 待取餐通知失败: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  private async notifyCustomerCancelRequestResult(
    order: OrderRecord,
    approve: boolean,
    reason?: string,
  ): Promise<void> {
    if (!order.userId) return;
    try {
      const label = this.formatOrderLabel(order);
      const amount = this.formatAmountYuan(order.total);
      await this.inboxService.create({
        userId: order.userId,
        type: approve ? 'order_cancel_approved' : 'order_cancel_rejected',
        title: approve ? '取消申请已通过' : '取消申请未通过',
        content: approve
          ? `订单 ${label} 商家已同意取消，${amount} 如已支付将原路退回`
          : `订单 ${label} 商家未同意取消${reason ? `：${reason}` : '，订单将继续履约'}`,
        relatedType: 'order',
        relatedId: order.id,
      });
    } catch (e) {
      this.logger.warn(
        `[Order] 顾客取消结果通知失败: ${e instanceof Error ? e.message : e}`,
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
      // v30: 优先走 PostgreSQL 端聚合 RPC（get_today_stats），
      // 一次 SQL 返回 total/revenue/pending/preparing/completed，
      // 避免 Node 端全量加载今日 tf_orders 行导致跨区网络下 5~7s 超时。
      // RPC 不存在（migration v30 未执行）时回退到原 SELECT 路径，幂等兼容。
      const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_today_stats', {
        p_shop_id: shopId,
      });
      if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
        const row = rpcRows[0] as {
          total_orders?: number;
          total_revenue?: number | string;
          pending_count?: number;
          preparing_count?: number;
          completed_count?: number;
        };
        return {
          totalOrders: Number(row.total_orders ?? 0),
          totalRevenue: Number(row.total_revenue ?? 0),
          pendingCount: Number(row.pending_count ?? 0),
          preparingCount: Number(row.preparing_count ?? 0),
          completedCount: Number(row.completed_count ?? 0),
        };
      }
      if (rpcErr) {
        // RPC 缺失或异常：打 warn 提示运维执行 migration，行为上回退到 SELECT
        this.logger.warn(
          `[OrderService] get_today_stats RPC unavailable, fallback to SELECT: ${rpcErr.message}`,
        );
      }

      // 兼容路径：两段 SELECT（预聚合表 + 今日 orders）
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
   * 待处理聚合（**不限时间维度**）。
   *
   * 语义：统计所有 `status IN ('paid','accepted')` 的订单，无论创建日期，
   * 即「钱已到账、但尚未开始制作」的积压待办。供 Dashboard 常驻「待处理」区使用，
   * 区别于 getTodayStats 的「今日」口径（后者仍受 created_at 今日过滤）。
   */
  async getPendingStats(shopId: string): Promise<PendingStats> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_orders')
        .select('status')
        .eq('shop_id', shopId)
        .in('status', [OrderStatus.PAID, OrderStatus.ACCEPTED]);
      if (error) {
        this.logger.error('[OrderService] getPendingStats error:', error.message);
        return { paid: 0, accepted: 0, total: 0 };
      }
      const rows = (data || []) as Pick<OrderRow, 'status'>[];
      const paid = rows.filter((o) => o.status === OrderStatus.PAID).length;
      const accepted = rows.filter((o) => o.status === OrderStatus.ACCEPTED).length;
      return { paid, accepted, total: paid + accepted };
    }

    assertMemoryFallbackAllowed('OrderService');
    const rows = Array.from(memoryOrders.values()).filter(
      (o) =>
        o.shopId === shopId &&
        (o.status === OrderStatus.PAID || o.status === OrderStatus.ACCEPTED),
    );
    const paid = rows.filter((o) => o.status === OrderStatus.PAID).length;
    const accepted = rows.filter((o) => o.status === OrderStatus.ACCEPTED).length;
    return { paid, accepted, total: paid + accepted };
  }

  /**
   * 按天聚合订单统计（用于 Dashboard 近 N 天趋势图）
   * 收入按 [completed, delivering, preparing] 状态计算（与 getTodayStats 口径一致）
   */
  async getDailyStats(
    shopId: string,
    days = 7,
    options?: { startDate?: string; endDate?: string },
  ): Promise<DailyStatsItem[]> {
    // days <= 0 表示「全部」：以最早订单为起点，跨度上限 366 天，避免桶数量失控
    // options.startDate/endDate（YYYY-MM-DD）优先于 days，用于自定义日历区间
    const ALL_TIME_MAX_DAYS = 366;
    const hasRange = !!(options?.startDate && options?.endDate);
    const allTime = !hasRange && (!days || days <= 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeEnd = hasRange
      ? (() => {
          const d = new Date(options!.endDate!);
          d.setHours(0, 0, 0, 0);
          return d;
        })()
      : today;
    const rangeStart = hasRange
      ? (() => {
          const d = new Date(options!.startDate!);
          d.setHours(0, 0, 0, 0);
          return d;
        })()
      : null;

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
    const buildBuckets = (
      spanDays: number,
      endAnchor: Date = rangeEnd,
      startAnchor?: Date | null,
    ): { buckets: DailyStatsItem[]; bucketMap: Map<string, DailyStatsItem>; start: Date } => {
      const safeSpan = Math.max(1, Math.min(spanDays, ALL_TIME_MAX_DAYS));
      const s = startAnchor
        ? new Date(startAnchor)
        : (() => {
            const d = new Date(endAnchor);
            d.setDate(d.getDate() - (safeSpan - 1));
            return d;
          })();
      s.setHours(0, 0, 0, 0);
      const actualSpan = startAnchor
        ? Math.max(
            1,
            Math.min(
              Math.floor((endAnchor.getTime() - s.getTime()) / 86400000) + 1,
              ALL_TIME_MAX_DAYS,
            ),
          )
        : safeSpan;
      const list: DailyStatsItem[] = [];
      for (let i = 0; i < actualSpan; i++) {
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
      // v30: 优先走 PostgreSQL 端聚合 RPC（get_daily_stats），
      // SQL 端 GROUP BY 按日聚合，Node 不再加载区间内全部订单行。
      // allTime 模式（"全部"）继续走原 SELECT，RPC 端 366 天上限与"全部"语义不一致。
      if (!allTime) {
        const rpcStartDate = hasRange && rangeStart
          ? options!.startDate!
          : (() => {
              const s = new Date(today);
              s.setDate(s.getDate() - (days - 1));
              const y = s.getFullYear();
              const m = String(s.getMonth() + 1).padStart(2, '0');
              const d = String(s.getDate()).padStart(2, '0');
              return `${y}-${m}-${d}`;
            })();
        const rpcEndDate = hasRange && rangeStart
          ? options!.endDate!
          : (() => {
              const y = today.getFullYear();
              const m = String(today.getMonth() + 1).padStart(2, '0');
              const d = String(today.getDate()).padStart(2, '0');
              return `${y}-${m}-${d}`;
            })();

        const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_daily_stats', {
          p_shop_id: shopId,
          p_start_date: rpcStartDate,
          p_end_date: rpcEndDate,
        });
        if (!rpcErr && Array.isArray(rpcRows)) {
          // RPC 已用 generate_series 补齐区间内所有日期，直接转 DailyStatsItem 返回
          return rpcRows.map((r: { stat_date?: string; orders?: number; revenue?: number | string }) => {
            // RPC 返回的 stat_date 是 date 类型，PostgREST 序列化为 YYYY-MM-DD 或 ISO 字符串
            const rawDate = r.stat_date;
            let dateStr: string;
            if (typeof rawDate === 'string') {
              dateStr = rawDate.split('T')[0];
            } else {
              dateStr = dateKey(rawDate as unknown as string | number | Date);
            }
            return {
              date: dateStr,
              orders: Number(r.orders ?? 0),
              revenue: Number(r.revenue ?? 0),
            };
          });
        }
        if (rpcErr) {
          this.logger.warn(
            `[OrderService] get_daily_stats RPC unavailable, fallback to SELECT: ${rpcErr.message}`,
          );
        }
      }

      let query = supabase
        .from('tf_orders')
        .select('status, total, created_at')
        .eq('shop_id', shopId);
      if (hasRange && rangeStart) {
        const endExclusive = new Date(rangeEnd);
        endExclusive.setDate(endExclusive.getDate() + 1);
        query = query
          .gte('created_at', rangeStart.toISOString())
          .lt('created_at', endExclusive.toISOString());
      } else if (!allTime) {
        const s = new Date(today);
        s.setDate(s.getDate() - (days - 1));
        query = query.gte('created_at', s.toISOString());
      }
      const { data, error } = await query;
      if (error) {
        this.logger.warn(`[OrderService] getDailyStats error: ${error.message}`);
        const { buckets } = buildBuckets(allTime ? 1 : days, rangeEnd, rangeStart);
        return buckets;
      }
      const rows = (data || []) as OrderRow[];
      const spanDays = allTime
        ? spanFromEarliest(rows.reduce<string | undefined>((min, r) => (!min || r.created_at < min ? r.created_at : min), undefined))
        : hasRange && rangeStart
          ? Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1
          : days;
      const { buckets, bucketMap } = buildBuckets(spanDays, rangeEnd, rangeStart);
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
      if (hasRange && rangeStart) return rangeStart.getTime();
      if (allTime) return 0;
      const s = new Date(today);
      s.setDate(s.getDate() - (days - 1));
      return s.getTime();
    })();
    const endForFilter = (() => {
      if (hasRange) {
        const endExclusive = new Date(rangeEnd);
        endExclusive.setDate(endExclusive.getDate() + 1);
        return endExclusive.getTime();
      }
      return Number.POSITIVE_INFINITY;
    })();
    const filtered = Array.from(memoryOrders.values()).filter((o) => {
      if (o.shopId !== shopId) return false;
      const t = new Date(o.createdAt).getTime();
      return t >= startForFilter && t < endForFilter;
    });
    const spanDays = allTime
      ? spanFromEarliest(
          filtered.reduce<string | undefined>(
            (min, o) => (!min || o.createdAt < min ? o.createdAt : min),
            undefined,
          ),
        )
      : hasRange && rangeStart
        ? Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1
        : days;
    const { buckets, bucketMap } = buildBuckets(spanDays, rangeEnd, rangeStart);
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
   * T246.2 按配送类型净化互斥字段（就地改写 dto）。
   * - 外卖 / 自取：不保留桌号
   * - 自取 / 堂食：不保留配送地址与配送坐标
   */
  private sanitizeDeliveryFields(dto: CreateOrderDto): void {
    if (dto.deliveryType !== DeliveryType.DINE_IN) {
      dto.tableNo = undefined;
    }
    if (dto.deliveryType !== DeliveryType.DELIVERY) {
      dto.address = undefined;
      dto.deliveryLatitude = undefined;
      dto.deliveryLongitude = undefined;
    }
  }

  private assertDeliveryTypeStatus(order: OrderRecord, next: OrderStatus): void {
    if (next === OrderStatus.READY_FOR_DELIVERY && order.deliveryType !== DeliveryType.DELIVERY) {
      throw new BadRequestException('仅外卖订单可进入待配送（待骑手接单）');
    }
    if (
      next === OrderStatus.READY_FOR_PICKUP &&
      order.deliveryType === DeliveryType.DELIVERY
    ) {
      throw new BadRequestException('外卖订单请使用「出餐完成（待骑手）」而非待取餐');
    }
    if (
      next === OrderStatus.DELIVERING &&
      order.deliveryType !== DeliveryType.DELIVERY
    ) {
      throw new BadRequestException('非外卖订单不能进入配送中');
    }
  }

  private buildEstimatedCompletionExtra(
    previousStatus: OrderStatus,
    dto: UpdateOrderDto,
  ): Record<string, unknown> {
    if (dto.status !== OrderStatus.ACCEPTED) return {};
    const minutes = dto.estimatedMinutes;
    if (minutes == null || !Number.isFinite(Number(minutes))) return {};
    const m = Math.min(120, Math.max(5, Math.round(Number(minutes))));
    const iso = new Date(Date.now() + m * 60_000).toISOString();
    return { estimated_completion: iso };
  }

  private applyEstimatedCompletionLocal(
    order: OrderRecord,
    etaExtra: Record<string, unknown>,
  ): void {
    if (typeof etaExtra.estimated_completion === 'string') {
      order.estimatedCompletion = etaExtra.estimated_completion;
    }
  }

  /** 支付超时自动取消 */
  async cancelExpiredPendingPayments(): Promise<number> {
    const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MINUTES * 60_000).toISOString();
    let cancelled = 0;

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_orders')
        .select('id')
        .eq('status', OrderStatus.PENDING_PAYMENT)
        .lt('created_at', cutoff)
        .limit(50);
      if (error) {
        this.logger.warn(`[Order] 查询超时待支付失败: ${error.message}`);
        return 0;
      }
      for (const row of data || []) {
        try {
          await this.cancelOrder(row.id, undefined, '支付超时自动取消');
          cancelled += 1;
        } catch (e) {
          this.logger.warn(
            `[Order] 自动取消超时单 ${row.id} 失败: ${e instanceof Error ? e.message : e}`,
          );
        }
      }
      return cancelled;
    }

    assertMemoryFallbackAllowed('OrderService.cancelExpiredPendingPayments');
    const cutoffMs = new Date(cutoff).getTime();
    for (const order of Array.from(memoryOrders.values())) {
      if (
        order.status === OrderStatus.PENDING_PAYMENT &&
        new Date(order.createdAt).getTime() < cutoffMs
      ) {
        try {
          await this.cancelOrder(order.id, undefined, '支付超时自动取消');
          cancelled += 1;
        } catch {
          /* ignore */
        }
      }
    }
    return cancelled;
  }

  /** 顾客催单 */
  async urgeOrder(id: string, userId: string): Promise<OrderRecord> {
    const order = await this.findById(id);
    if (order.userId !== userId) {
      throw new BadRequestException('只能催自己的订单');
    }
    const urgeable = new Set<OrderStatus>([
      OrderStatus.PAID,
      OrderStatus.ACCEPTED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_DELIVERY,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DELIVERING,
    ]);
    if (!urgeable.has(order.status)) {
      throw new BadRequestException('当前状态不可催单');
    }
    if (order.lastUrgedAt) {
      const elapsed = Date.now() - new Date(order.lastUrgedAt).getTime();
      if (elapsed < ORDER_URGE_COOLDOWN_MINUTES * 60_000) {
        const remain = Math.ceil(
          (ORDER_URGE_COOLDOWN_MINUTES * 60_000 - elapsed) / 60_000,
        );
        throw new BadRequestException(`催单过于频繁，请 ${remain} 分钟后再试`);
      }
    }
    const now = new Date().toISOString();
    const nextCount = (order.urgeCount || 0) + 1;

    if (hasSupabase() && supabase) {
      const { error } = await supabase
        .from('tf_orders')
        .update({
          last_urged_at: now,
          urge_count: nextCount,
          updated_at: now,
        })
        .eq('id', id);
      if (error && !this.isMissingColumnError(error)) {
        throw new BadRequestException(`催单失败: ${error.message}`);
      }
    } else {
      assertMemoryFallbackAllowed('OrderService.urgeOrder');
    }

    order.lastUrgedAt = now;
    order.urgeCount = nextCount;
    order.updatedAt = now;
    memoryOrders.set(id, { ...order });
    try {
      this.orderGateway.emitOrderUpdated(order, order.status);
    } catch (e) {
      this.logger.warn(e instanceof Error ? e.message : String(e));
    }
    // 商家语音播报：顾客催单
    void this.notifyShopStaff({
      shopId: order.shopId,
      type: 'order_reminder',
      title: '顾客催单',
      content: `订单 ${this.formatOrderLabel(order)} 顾客第 ${nextCount} 次催单，请尽快处理`,
      relatedId: order.id,
    });
    return order;
  }

  /** 顾客申请取消（接单后） */
  async requestCancel(id: string, userId: string, reason: string): Promise<OrderRecord> {
    const cancelReason = (reason || '').trim();
    if (!cancelReason) throw new BadRequestException('申请取消原因不能为空');
    const order = await this.findById(id);
    if (order.userId !== userId) {
      throw new BadRequestException('只能操作自己的订单');
    }
    if (!CANCEL_REQUESTABLE.has(order.status)) {
      throw new BadRequestException(`订单状态为 ${order.status}，不可申请取消`);
    }
    if (order.cancelRequestedAt) {
      throw new BadRequestException('已提交取消申请，请等待商家处理');
    }
    const now = new Date().toISOString();
    if (hasSupabase() && supabase) {
      const { error } = await supabase
        .from('tf_orders')
        .update({
          cancel_requested_at: now,
          cancel_request_reason: cancelReason,
          updated_at: now,
        })
        .eq('id', id);
      if (error && !this.isMissingColumnError(error)) {
        throw new BadRequestException(`申请取消失败: ${error.message}`);
      }
    } else {
      assertMemoryFallbackAllowed('OrderService.requestCancel');
    }
    order.cancelRequestedAt = now;
    order.cancelRequestReason = cancelReason;
    order.updatedAt = now;
    memoryOrders.set(id, { ...order });
    try {
      this.orderGateway.emitOrderUpdated(order, order.status);
    } catch (e) {
      this.logger.warn(e instanceof Error ? e.message : String(e));
    }
    // 站内消息通知商家处理售后
    void this.notifyShopStaffCancelRequest(order);
    return order;
  }

  /** 商家处理取消申请 */
  async resolveCancelRequest(
    id: string,
    approve: boolean,
    reason?: string,
  ): Promise<OrderRecord> {
    const order = await this.findById(id);
    if (!order.cancelRequestedAt) {
      throw new BadRequestException('该订单没有待处理的取消申请');
    }
    if (approve) {
      const cancelReason =
        (reason || '').trim() ||
        order.cancelRequestReason ||
        '商家同意顾客取消申请';
      const updated = await this.cancelOrder(id, undefined, cancelReason);
      void this.notifyCustomerCancelRequestResult(updated, true);
      return updated;
    }
    const now = new Date().toISOString();
    if (hasSupabase() && supabase) {
      const { error } = await supabase
        .from('tf_orders')
        .update({
          cancel_requested_at: null,
          cancel_request_reason: null,
          updated_at: now,
        })
        .eq('id', id);
      if (error && !this.isMissingColumnError(error)) {
        throw new BadRequestException(`处理取消申请失败: ${error.message}`);
      }
    } else {
      assertMemoryFallbackAllowed('OrderService.resolveCancelRequest');
    }
    order.cancelRequestedAt = undefined;
    order.cancelRequestReason = undefined;
    order.updatedAt = now;
    memoryOrders.set(id, { ...order });
    try {
      this.orderGateway.emitOrderUpdated(order, order.status);
    } catch (e) {
      this.logger.warn(e instanceof Error ? e.message : String(e));
    }
    void this.notifyCustomerCancelRequestResult(order, false, reason);
    return order;
  }

  /** 骑手释放订单回待抢池 */
  async releaseOrder(id: string, riderId: string): Promise<OrderRecord> {
    const order = await this.findById(id);
    if (order.deliveryType !== DeliveryType.DELIVERY) {
      throw new BadRequestException('仅外卖订单可释放');
    }
    if (order.status !== OrderStatus.DELIVERING) {
      throw new BadRequestException('仅配送中订单可释放回抢单池');
    }
    const owner = order.riderId || memoryRiderClaims.get(id);
    if (!owner || owner !== riderId) {
      throw new BadRequestException('只能释放自己领取的订单');
    }
    const previousStatus = order.status;
    const now = new Date().toISOString();

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_orders')
        .update({
          status: OrderStatus.READY_FOR_DELIVERY,
          rider_id: null,
          updated_at: now,
        })
        .eq('id', id)
        .eq('status', OrderStatus.DELIVERING)
        .eq('rider_id', riderId)
        .select()
        .maybeSingle();
      if (error) throw new BadRequestException(`释放订单失败: ${error.message}`);
      if (!data) throw new BadRequestException('释放失败，订单状态已变更');
    } else {
      assertMemoryFallbackAllowed('OrderService.releaseOrder');
      order.status = OrderStatus.READY_FOR_DELIVERY;
      order.riderId = undefined;
      order.updatedAt = now;
      memoryOrders.set(id, order);
    }

    memoryRiderClaims.delete(id);
    await this.recordStatusHistory(
      order,
      OrderStatus.READY_FOR_DELIVERY,
      previousStatus,
      now,
    );
    const updated = await this.findById(id);
    updated.riderId = undefined;
    updated.status = OrderStatus.READY_FOR_DELIVERY;
    try {
      this.orderGateway.emitOrderUpdated(updated, previousStatus);
    } catch (e) {
      this.logger.warn(e instanceof Error ? e.message : String(e));
    }
    return updated;
  }

  /** 详情附加店铺/骑手联系方式 */
  async attachContactHints(order: OrderRecord): Promise<OrderRecord> {
    try {
      const shop = await this.shopService.findById(order.shopId);
      order.shopPhone = (shop as any)?.phone || order.shopPhone;
      order.shopName = (shop as any)?.name || order.shopName;
      // T246.4 自取订单需要门店地址与坐标做一键导航
      order.shopAddress = (shop as any)?.address || order.shopAddress;
      // 下单时未写入坐标快照的历史单，回退到店铺当前坐标
      if (order.shopLatitude === undefined || order.shopLongitude === undefined) {
        const point = normalizeGeoPoint(
          (shop as any)?.latitude,
          (shop as any)?.longitude,
        );
        if (point) {
          order.shopLatitude = point.latitude;
          order.shopLongitude = point.longitude;
        }
      }
    } catch (e) {
      this.logger.warn(
        `[Order] 附加店铺电话失败: ${e instanceof Error ? e.message : e}`,
      );
    }
    return order;
  }

  private validateStatusTransition(current: OrderStatus, next: OrderStatus): void {
    // 外送: pending_payment → paid → accepted → preparing → ready_for_delivery → delivering → completed
    // 自取/堂食: pending_payment → paid → accepted → preparing → ready_for_pickup → completed
    // 取消: 待支付~待取餐/待配送；拒单: 仅 paid
    // 骑手释放: delivering → ready_for_delivery（仅 releaseOrder，不走普通 updateStatus）
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
      [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [
        OrderStatus.READY_FOR_DELIVERY,
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.READY_FOR_DELIVERY]: [OrderStatus.DELIVERING, OrderStatus.CANCELLED],
      [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
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
