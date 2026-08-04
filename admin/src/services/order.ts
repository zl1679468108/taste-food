import request from '@/utils/request';


export interface DeliveryProofPhoto {
  url: string;
  path?: string;
  uploadedAt?: string;
}

export interface DeliveryProof {
  photos: DeliveryProofPhoto[];
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

export interface Order {
  id: string;
  /** 业务订单号（若后端提供则优先展示） */
  orderNo?: string;
  order_no?: string;
  shopId: string;
  userId: string;
  riderId?: string;
  /** 骑手当前同时配送单数 */
  riderDeliveryCount?: number;
  /** 店铺坐标（外送订单用于腾讯地图起点） */
  shopLatitude?: number;
  shopLongitude?: number;
  /** 收货地址坐标（外送订单用于腾讯地图终点） */
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  status: string;
  total: number;
  deliveryFee: number;
  deliveryType: string;
  address?: string;
  tableNo?: string;
  remark?: string;
  cancelReason?: string;
  rejectReason?: string;
  contactName?: string;
  contactPhone?: string;
  invoiceNeeded?: boolean;
  invoiceTitle?: string;
  invoiceTaxNo?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  statusHistory?: Array<{ status: string; time: string; fromStatus?: string }>;
  deliveryProof?: DeliveryProof;
  /** 预计完成/出餐时间 ISO */
  estimatedCompletion?: string;
  /** 顾客申请取消时间 */
  cancelRequestedAt?: string;
  /** 顾客申请取消原因 */
  cancelRequestReason?: string;
  /** 最近催单时间 */
  lastUrgedAt?: string;
  /** 催单次数 */
  urgeCount?: number;
  /** 店铺电话（详情可附带） */
  shopPhone?: string;
  /** 店铺名称 */
  shopName?: string;
  /** 骑手电话 */
  riderPhone?: string;
  /** 骑手昵称 */
  riderName?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  specDesc: string;
  imageUrl: string;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingCount: number;
  preparingCount: number;
  completedCount: number;
}

/** 订单列表状态标签数量（v34：GET /api/orders/counts） */
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

/** 不限时间维度的待处理聚合（对应 GET /api/orders/stats/pending） */
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

export const getOrders = (params: { shop_id?: string; status?: string; page: number; pageSize: number; keyword?: string }) => {
  const query: Record<string, string | number> = { page: params.page, pageSize: params.pageSize };
  // 平台管理员全店视角：不传 shop_id，由后端跨店查询
  if (params.shop_id) query.shop_id = params.shop_id;
  if (params.status) query.status = params.status;
  if (params.keyword) query.keyword = params.keyword;
  return request.get('/api/orders', { params: query }) as Promise<{ items: Order[]; total: number; counts?: OrderStatusCounts }>;
};

/** 订单状态数量聚合（v34）：一次请求替代多次按状态查列表 count */
export const getOrderStatusCounts = (params: { shop_id?: string; keyword?: string }) => {
  const query: Record<string, string> = {};
  // 平台管理员全店视角：不传 shop_id，由后端跨店查询
  if (params.shop_id) query.shop_id = params.shop_id;
  if (params.keyword) query.keyword = params.keyword;
  return request.get('/api/orders/counts', { params: query }) as Promise<OrderStatusCounts>;
};

export const getOrder = (id: string) =>
  request.get(`/api/orders/${id}`) as Promise<Order>;

/** 配送轨迹点（GET /api/orders/:id/delivery-track，按 recordedAt 升序） */
export interface DeliveryTrackPoint {
  id: string;
  orderId: string;
  shopId: string;
  riderId?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  accuracy?: number;
  /** 上报来源：rider | rider_auto | rider_location | demo_location */
  source: string;
  recordedAt: string;
  createdAt: string;
}

/** 拉取配送轨迹（非外送订单返回空数组） */
export const getDeliveryTrack = (id: string) =>
  request.get(`/api/orders/${id}/delivery-track`, {
    skipErrorMessage: true,
  }) as Promise<DeliveryTrackPoint[]>;

/** 拉取配送轨迹腾讯静态地图图片（blob；失败由面板降级 iframe） */
export const getDeliveryMapImage = (id: string, cacheBust?: string) =>
  request.get(`/api/orders/${id}/delivery-map`, {
    params: cacheBust ? { t: cacheBust } : undefined,
    responseType: 'blob',
    skipErrorMessage: true,
  }) as Promise<Blob>;


/** 今日统计（优先使用当前店铺上下文 shop_id） */
export const getOrderStats = (shopId?: string) =>
  request.get('/api/orders/stats/today', {
    params: shopId ? { shop_id: shopId } : undefined,
    // Supabase 跨区冷启动时 stats RPC 仍可能 5~7s；给足余量避免 axios 10s timeout
    // 触发 "timeout of 10000ms exceeded"。RPC 修复后单次 <1s，实际不会等满。
    timeout: 30000,
  }) as Promise<OrderStats>;

/** 待处理聚合（**不限时间维度**，对应 GET /api/orders/stats/pending） */
export const getPendingStats = (shopId?: string) =>
  request.get('/api/orders/stats/pending', {
    params: shopId ? { shop_id: shopId } : undefined,
    timeout: 30000,
  }) as Promise<PendingStats>;

/** 近 N 天日趋势；可选 startDate/endDate（YYYY-MM-DD）覆盖 days */
export const getDailyStats = (
  shopId: string | undefined,
  days = 7,
  range?: { startDate?: string; endDate?: string },
) =>
  request.get('/api/orders/stats/daily', {
    params: {
      days,
      ...(shopId ? { shop_id: shopId } : {}),
      ...(range?.startDate && range?.endDate
        ? { start_date: range.startDate, end_date: range.endDate }
        : {}),
    },
    // 同上：dashboard 趋势查询允许更长 timeout，避免 10s 边界抖动
    timeout: 30000,
  }) as Promise<DailyStatsItem[]>;

export const updateOrderStatus = (
  id: string,
  status: string,
  reason?: string,
  estimatedMinutes?: number,
) =>
  request.post(`/api/orders/${id}/status`, {
    status,
    ...(reason ? { reason } : {}),
    ...(typeof estimatedMinutes === 'number' ? { estimatedMinutes } : {}),
  }) as Promise<Order>;

// 取消订单：调用专用 /cancel 接口（后端原子处理状态校验 + 退款记录 + daily_stats 联动）
export const cancelOrder = (id: string, reason: string) =>
  request.post(`/api/orders/${id}/cancel`, { reason }) as Promise<Order>;

/** 处理顾客取消申请（同意则取消并退款，拒绝则清除申请标记） */
export const resolveCancelRequest = (
  id: string,
  payload: { approve: boolean; reason?: string },
) =>
  request.post(`/api/orders/${id}/cancel-request/resolve`, payload) as Promise<Order>;

/** 导出订单（服务端生成；可能返回 csv 字符串或 xlsx base64/blob 字段） */
export interface OrderExportResult {
  /** CSV 文本（含 BOM 亦可） */
  csv?: string;
  /** xlsx 文件 base64 */
  xlsxBase64?: string;
  xlsx?: string;
  /** 兼容其它命名 */
  base64?: string;
  content?: string;
  /** 直接可用的 blob（部分封装） */
  blob?: Blob;
  count: number;
  filename: string;
  xlsxFilename?: string;
  contentType?: string;
}

export const exportOrders = (params?: {
  shop_id?: string;
  status?: string;
  maxRows?: number;
  format?: 'csv' | 'xlsx' | 'both';
}) =>
  request.get('/api/orders/export', { params: { format: 'xlsx', ...params } }) as Promise<OrderExportResult>;


/** 商家/管理员强制完成外卖配送单 */
export const forceCompleteOrder = (id: string, reason: string) =>
  request.post(`/api/orders/${id}/force-complete`, { reason }) as Promise<Order>;

/**
 * §3.23 / T246.7 商家到店核销（自取/堂食 ready_for_pickup → completed）
 * 仅 `merchant` 角色有效，且校验店铺归属；二维码内容 = 订单 ID
 */
export const verifyPickupOrder = (id: string) =>
  request.post(`/api/orders/${id}/verify`, {}) as Promise<Order>;
