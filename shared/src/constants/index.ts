/**
 * 全局共享常量
 * 与 server 端 common/constants/enums.ts 保持一致
 */

/** 订单状态枚举 */
export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  ACCEPTED = 'accepted',
  PREPARING = 'preparing',
  /** 外卖：出餐完成，等待骑手抢单 */
  READY_FOR_DELIVERY = 'ready_for_delivery',
  READY_FOR_PICKUP = 'ready_for_pickup',
  DELIVERING = 'delivering',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

/** 配送方式枚举 */
export enum DeliveryType {
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
  DINE_IN = 'dine_in',
}

/** 菜品状态枚举 */
export enum MenuItemStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/** 店铺状态枚举 */
export enum ShopStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

/** 用户角色枚举 */
export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  RIDER = 'rider',
  MERCHANT = 'merchant',
}

/** 促销类型枚举 */
export enum PromotionType {
  FULL_DISCOUNT = 'full_discount',
  FIRST_ORDER = 'first_order',
  COUPON = 'coupon',
  DISCOUNT = 'discount',
}

/** 促销状态枚举 */
export enum PromotionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
}

/**
 * 默认店铺 ID（单店铺场景兜底，多店铺场景由 admin 绑定的 shopId 覆盖）
 * 与 server 端 common/constants/shop.ts、database-init.sql 种子数据保持一致
 */
export const DEFAULT_SHOP_ID = '00000000-0000-0000-0000-000000000001';

/** 待支付超时自动取消（分钟） */
export const PAYMENT_TIMEOUT_MINUTES = 5;

/** 顾客催单最小间隔（分钟） */
export const ORDER_URGE_COOLDOWN_MINUTES = 10;

/** 骑手确认送达默认地理围栏半径（米） */
export const DELIVERY_CONFIRM_RADIUS_M = 500;

/** 半径硬上限（米） */
export const DELIVERY_CONFIRM_RADIUS_MAX_M = 1000;

/** 半径硬下限（米） */
export const DELIVERY_CONFIRM_RADIUS_MIN_M = 200;

/** 定位精度额外缓冲上限（米） */
export const DELIVERY_CONFIRM_ACCURACY_BUFFER_MAX_M = 50;

/** 送达凭证最少照片数 */
export const DELIVERY_PROOF_MIN_PHOTOS = 1;

/** 送达凭证最多照片数 */
export const DELIVERY_PROOF_MAX_PHOTOS = 3;

/** 顾客端「进行中」状态集合 */
export const CUSTOMER_ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.DELIVERING,
];

/** 顾客端「历史」状态集合（兼容旧筛选；新 UI 已改为退款售后） */
export const CUSTOMER_HISTORY_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
];

/** 顾客端「退款售后」终态集合（取消申请中需结合 cancel_requested_at 另查） */
export const CUSTOMER_REFUND_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
];

/** 列表筛选分组 key：退款售后 */
export const ORDER_LIST_REFUND_FILTER_KEYS = ['refund', 'after_sale', 'after-sale'] as const;

/** 是否为退款售后列表筛选 */
export function isRefundOrderListFilter(status?: string): boolean {
  if (!status) return false;
  const raw = status.trim().toLowerCase();
  return (ORDER_LIST_REFUND_FILTER_KEYS as readonly string[]).includes(raw);
}

/** 商家接单后仍可关单/退款的状态 */
export const MERCHANT_CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
];

/** 顾客可自主取消的状态 */
export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
];

/** 顾客可申请取消的状态（接单后） */
export const CUSTOMER_CANCEL_REQUESTABLE_STATUSES: OrderStatus[] = [
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
];

/** 订单状态中文映射 */
export const ORDER_STATUS_MAP: Record<string, string> = {
  [OrderStatus.PENDING_PAYMENT]: '待支付',
  [OrderStatus.PAID]: '已支付',
  [OrderStatus.ACCEPTED]: '已接单',
  [OrderStatus.PREPARING]: '制作中',
  [OrderStatus.READY_FOR_DELIVERY]: '待配送',
  [OrderStatus.READY_FOR_PICKUP]: '待取餐',
  [OrderStatus.DELIVERING]: '配送中',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.CANCELLED]: '已取消',
  [OrderStatus.REJECTED]: '已拒单',
};

/**
 * 按配送类型返回更贴合业务的状态文案
 * - pickup: 待自取
 * - dine_in: 待取餐
 * - delivery: ready_for_delivery = 待骑手接单
 */
export function getOrderStatusLabel(status?: string, deliveryType?: string): string {
  if (!status) return '';
  if (status === OrderStatus.READY_FOR_PICKUP) {
    if (deliveryType === DeliveryType.PICKUP) return '待自取';
    if (deliveryType === DeliveryType.DINE_IN) return '待取餐';
    return '待取餐';
  }
  if (status === OrderStatus.READY_FOR_DELIVERY) {
    return '待配送';
  }
  return ORDER_STATUS_MAP[status] || status;
}

/**
 * 顾客端状态说明（与商家端操作一一对应）
 */
export function getCustomerOrderStatusHint(status?: string, deliveryType?: string): string {
  switch (status) {
    case OrderStatus.PENDING_PAYMENT:
      return `请尽快完成支付，${PAYMENT_TIMEOUT_MINUTES} 分钟未支付将自动取消`;
    case OrderStatus.PAID:
      return '已支付，等待商家接单';
    case OrderStatus.ACCEPTED:
      return '商家已接单，即将开始制作';
    case OrderStatus.PREPARING:
      return '商家正在制作中，请耐心等待';
    case OrderStatus.READY_FOR_DELIVERY:
      return '餐品已出餐，正在等待骑手接单';
    case OrderStatus.READY_FOR_PICKUP:
      return deliveryType === DeliveryType.DINE_IN
        ? '餐品已备好，请到店取餐'
        : '餐品已备好，请到店自取';
    case OrderStatus.DELIVERING:
      return '订单配送中，请留意骑手电话';
    case OrderStatus.COMPLETED:
      return '订单已完成，欢迎再次光临';
    case OrderStatus.CANCELLED:
      return '订单已取消，如已支付将原路退回';
    case OrderStatus.REJECTED:
      return '商家已拒单，如已支付将原路退回';
    default:
      return '';
  }
}

/** 支付记录状态（与 tf_payments.status 对齐） */
export type PaymentRecordStatus = 'pending' | 'paid' | 'success' | 'refunded' | 'failed';

/** 是否已产生有效支付（兼容历史 success 与规范 paid） */
export function isPaidPaymentStatus(status?: string | null): boolean {
  return status === 'paid' || status === 'success' || status === 'refunded';
}

export interface AfterSaleViewInput {
  status?: string;
  cancelRequestedAt?: string | null;
  cancelRequestReason?: string | null;
  cancelReason?: string | null;
  rejectReason?: string | null;
  updatedAt?: string;
  /** 支付状态：无支付记录表示未支付或无支付单 */
  paymentStatus?: PaymentRecordStatus | string | null;
}

/** 是否处于退款售后相关态（取消申请中 / 已取消 / 已拒单） */
export function isAfterSaleOrder(input: AfterSaleViewInput): boolean {
  if (!input.status) return false;
  if (input.status === OrderStatus.CANCELLED || input.status === OrderStatus.REJECTED) {
    return true;
  }
  return Boolean(input.cancelRequestedAt) && !isTerminalStatus(input.status);
}

/** 顾客端售后主标题（详情顶部优先于普通状态文案） */
export function getCustomerAfterSaleTitle(input: AfterSaleViewInput): string {
  if (input.cancelRequestedAt && input.status && !isTerminalStatus(input.status)) {
    return '售后处理中';
  }
  if (input.status === OrderStatus.REJECTED) {
    if (input.paymentStatus === 'refunded') return '已拒单 · 退款成功';
    if (isPaidPaymentStatus(input.paymentStatus)) return '已拒单 · 退款处理中';
    return '已拒单';
  }
  if (input.status === OrderStatus.CANCELLED) {
    if (input.paymentStatus === 'refunded') return '退款成功';
    if (isPaidPaymentStatus(input.paymentStatus)) return '退款处理中';
    return '已取消';
  }
  return '';
}

/** 顾客端售后说明 */
export function getCustomerAfterSaleHint(input: AfterSaleViewInput): string {
  if (input.cancelRequestedAt && input.status && !isTerminalStatus(input.status)) {
    const reason = input.cancelRequestReason?.trim();
    return reason
      ? `已提交取消申请（${reason}），等待商家处理`
      : '已提交取消申请，等待商家处理；同意后如已支付将原路退回';
  }
  if (input.status === OrderStatus.REJECTED) {
    if (input.paymentStatus === 'refunded') {
      return '商家已拒单，退款已原路返回，预计 1-3 个工作日到账';
    }
    if (isPaidPaymentStatus(input.paymentStatus)) {
      return '商家已拒单，退款处理中，请稍后在支付渠道查看';
    }
    return input.rejectReason
      ? `商家已拒单：${input.rejectReason}`
      : '商家已拒单，订单已关闭';
  }
  if (input.status === OrderStatus.CANCELLED) {
    if (input.paymentStatus === 'refunded') {
      return '订单已取消，退款已原路返回，预计 1-3 个工作日到账';
    }
    if (isPaidPaymentStatus(input.paymentStatus)) {
      return '订单已取消，退款处理中，请稍后在支付渠道查看';
    }
    return input.cancelReason
      ? `订单已取消：${input.cancelReason}`
      : '订单已取消（未支付，无需退款）';
  }
  return '';
}

export interface AfterSaleStep {
  key: string;
  title: string;
  desc?: string;
  time?: string;
  /** done | current | todo */
  state: 'done' | 'current' | 'todo';
}

/** 商家端列表/详情售后角标文案 */
export function getMerchantAfterSaleLabel(input: AfterSaleViewInput): string {
  if (input.cancelRequestedAt && input.status && !isTerminalStatus(input.status)) {
    return '售后待处理';
  }
  if (input.status === OrderStatus.CANCELLED) {
    if (input.paymentStatus === 'refunded') return '已取消已退款';
    return '已取消';
  }
  if (input.status === OrderStatus.REJECTED) {
    if (input.paymentStatus === 'refunded') return '已拒单已退款';
    return '已拒单';
  }
  return '';
}

/** 构建售后进度步骤（无售后态返回空数组） */
export function buildAfterSaleSteps(input: AfterSaleViewInput): AfterSaleStep[] {
  if (!isAfterSaleOrder(input)) return [];

  // 进行中的取消申请
  if (input.cancelRequestedAt && input.status && !isTerminalStatus(input.status)) {
    return [
      {
        key: 'submit',
        title: '提交取消申请',
        desc: input.cancelRequestReason?.trim() || '已提交，等待商家确认',
        time: input.cancelRequestedAt || undefined,
        state: 'done',
      },
      {
        key: 'review',
        title: '商家处理中',
        desc: '商家同意后将关单并退款；也可联系商家加急',
        state: 'current',
      },
      {
        key: 'refund',
        title: '退款到账',
        desc: '如已支付，退款将原路返回',
        state: 'todo',
      },
    ];
  }

  const endTime = input.updatedAt || undefined;
  const paidLike = isPaidPaymentStatus(input.paymentStatus);
  const refunded = input.paymentStatus === 'refunded';

  if (input.status === OrderStatus.REJECTED) {
    const steps: AfterSaleStep[] = [
      {
        key: 'reject',
        title: '商家已拒单',
        desc: input.rejectReason?.trim() || '商家拒绝接单',
        time: endTime,
        state: 'done',
      },
    ];
    if (!paidLike) {
      steps.push({
        key: 'close',
        title: '订单已关闭',
        desc: '未产生支付，无需退款',
        time: endTime,
        state: 'done',
      });
      return steps;
    }
    steps.push({
      key: 'refund',
      title: refunded ? '退款成功' : '退款处理中',
      desc: refunded
        ? '款项已原路返回，预计 1-3 个工作日到账'
        : '正在办理退款，请稍后在支付渠道查看',
      time: refunded ? endTime : undefined,
      state: refunded ? 'done' : 'current',
    });
    return steps;
  }

  // cancelled
  const steps: AfterSaleStep[] = [
    {
      key: 'cancel',
      title: '订单已取消',
      desc: input.cancelReason?.trim() || '订单已关闭',
      time: endTime,
      state: 'done',
    },
  ];
  if (!paidLike) {
    steps.push({
      key: 'close',
      title: '无需退款',
      desc: '订单取消时尚未支付',
      time: endTime,
      state: 'done',
    });
    return steps;
  }
  steps.push({
    key: 'refund',
    title: refunded ? '退款成功' : '退款处理中',
    desc: refunded
      ? '款项已原路返回，预计 1-3 个工作日到账'
      : '正在办理退款，请稍后在支付渠道查看',
    time: refunded ? endTime : undefined,
    state: refunded ? 'done' : 'current',
  });
  return steps;
}


/** 商家端下一步主操作文案（与顾客提示对应） */
export function getMerchantOrderActionHint(status?: string, deliveryType?: string): string {
  switch (status) {
    case OrderStatus.PAID:
      return '待接单：可接单（可填预计出餐分钟）或拒单';
    case OrderStatus.ACCEPTED:
      return '已接单：开始制作；异常可取消退款';
    case OrderStatus.PREPARING:
      if (deliveryType === DeliveryType.DELIVERY) return '制作中：出餐完成（进入待骑手抢单）';
      if (deliveryType === DeliveryType.DINE_IN) return '制作中：标记待取餐';
      return '制作中：标记待自取';
    case OrderStatus.READY_FOR_DELIVERY:
      return '待骑手接单：可等待抢单，异常可取消退款';
    case OrderStatus.READY_FOR_PICKUP:
      return '待取餐：确认顾客已取餐；超时可取消';
    case OrderStatus.DELIVERING:
      return '配送中：骑手送达；异常可强制完成';
    default:
      return '';
  }
}

/** 配送方式中文映射（三端统一文案） */
export const DELIVERY_TYPE_MAP: Record<string, string> = {
  [DeliveryType.DELIVERY]: '外卖配送',
  [DeliveryType.PICKUP]: '到店自取',
  [DeliveryType.DINE_IN]: '堂食',
};

/**
 * 备注快捷标签（T246.5）
 * COMMON 三种配送方式都展示；PICKUP 仅到店自取/堂食（需要到店）展示。
 */
export const ORDER_REMARK_TAGS_COMMON: readonly string[] = [
  '不要餐具',
  '多加辣',
  '少辣',
  '不要葱',
  '不要香菜',
];

/** 到店场景（自取/堂食）专属备注标签 */
export const ORDER_REMARK_TAGS_PICKUP: readonly string[] = [
  '到店时间约 15 分钟',
  '到店时间约 30 分钟',
  '请帮忙保温',
  '打包带走',
];

/**
 * 按配送类型返回备注快捷标签。
 * 到店场景（pickup/dine_in）额外追加到店时间等标签。
 */
export function getRemarkTagsByDeliveryType(
  deliveryType: DeliveryType | string,
): string[] {
  const needsVisit =
    deliveryType === DeliveryType.PICKUP || deliveryType === DeliveryType.DINE_IN;
  return needsVisit
    ? [...ORDER_REMARK_TAGS_PICKUP, ...ORDER_REMARK_TAGS_COMMON]
    : [...ORDER_REMARK_TAGS_COMMON];
}

/** 订单状态颜色映射（用于 UI 标签着色） */
export const ORDER_STATUS_COLOR_MAP: Record<string, string> = {
  [OrderStatus.PENDING_PAYMENT]: '#f59e0b',
  [OrderStatus.PAID]: '#3b82f6',
  [OrderStatus.ACCEPTED]: '#8b5cf6',
  [OrderStatus.PREPARING]: '#f97316',
  [OrderStatus.READY_FOR_DELIVERY]: '#0ea5e9',
  [OrderStatus.READY_FOR_PICKUP]: '#d946ef',
  [OrderStatus.DELIVERING]: '#06b6d4',
  [OrderStatus.COMPLETED]: '#22c55e',
  [OrderStatus.CANCELLED]: '#6b7280',
  [OrderStatus.REJECTED]: '#ef4444',
};

/** 促销类型中文映射 */
export const PROMOTION_TYPE_MAP: Record<string, string> = {
  [PromotionType.FULL_DISCOUNT]: '满减',
  [PromotionType.FIRST_ORDER]: '首单优惠',
  [PromotionType.COUPON]: '优惠券',
  [PromotionType.DISCOUNT]: '折扣',
};

/** 用户角色中文映射 */
export const USER_ROLE_MAP: Record<string, string> = {
  [UserRole.CUSTOMER]: '顾客',
  [UserRole.ADMIN]: '管理员',
  [UserRole.RIDER]: '骑手',
  [UserRole.MERCHANT]: '商家',
};

/**
 * 订单状态合法流转
 * 外送: pending_payment → paid → accepted → preparing → ready_for_delivery → delivering → completed
 * 自取/堂食: pending_payment → paid → accepted → preparing → ready_for_pickup → completed
 * 取消: 待支付/已支付/已接单/制作中/待配送/待取餐 → cancelled
 * 拒单: 仅 paid → rejected
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
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
  [OrderStatus.DELIVERING]: [OrderStatus.COMPLETED, OrderStatus.READY_FOR_DELIVERY],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REJECTED]: [],
};

/** 检查状态流转是否合法 */
export function canTransitionTo(from: string, to: string): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

/** 是否终态 */
export function isTerminalStatus(status: string): boolean {
  return (
    status === OrderStatus.COMPLETED ||
    status === OrderStatus.CANCELLED ||
    status === OrderStatus.REJECTED
  );
}

/** 解析列表筛选：支持单状态、逗号多状态、active/history/review/refund 分组 */
export function resolveOrderStatusFilter(status?: string): string[] | undefined {
  if (!status || !status.trim()) return undefined;
  const raw = status.trim().toLowerCase();
  if (raw === 'active') return [...CUSTOMER_ACTIVE_ORDER_STATUSES];
  if (raw === 'history') return [...CUSTOMER_HISTORY_ORDER_STATUSES];
  if (raw === 'review') return [OrderStatus.COMPLETED];
  // 退款售后：终态为 cancelled/rejected；进行中的取消申请需调用方叠加 cancel_requested_at 条件
  if (isRefundOrderListFilter(raw)) return [...CUSTOMER_REFUND_ORDER_STATUSES];
  if (raw.includes(',')) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [raw];
}

// ============================================================
// 批量异步导出（T267）
// 与 server/src/common/constants/export.ts 双写保持一致（server 不接 shared）
// ============================================================

/** 导出任务状态机：pending → processing → completed / failed */
export enum ExportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/** 可导出的业务实体 */
export enum ExportEntity {
  ORDERS = 'orders',
}

/** 当前仅支持 Excel（xlsx），不走 CSV */
export const EXPORT_FORMAT_XLSX = 'xlsx';

export const EXPORT_JOB_STATUSES: ExportJobStatus[] = [
  ExportJobStatus.PENDING,
  ExportJobStatus.PROCESSING,
  ExportJobStatus.COMPLETED,
  ExportJobStatus.FAILED,
];

export const EXPORT_ENTITIES: ExportEntity[] = [ExportEntity.ORDERS];

/** 导出任务状态中文文案（三端统一） */
export const EXPORT_JOB_STATUS_LABEL: Record<string, string> = {
  [ExportJobStatus.PENDING]: '排队中',
  [ExportJobStatus.PROCESSING]: '导出中',
  [ExportJobStatus.COMPLETED]: '已完成',
  [ExportJobStatus.FAILED]: '失败',
};
