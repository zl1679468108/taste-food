import request from '@/utils/request';

export interface Order {
  id: string;
  /** 业务订单号（若后端提供则优先展示） */
  orderNo?: string;
  order_no?: string;
  shopId: string;
  userId: string;
  riderId?: string;
  status: string;
  total: number;
  deliveryFee: number;
  deliveryType: string;
  address?: string;
  tableNo?: string;
  remark?: string;
  contactName?: string;
  contactPhone?: string;
  invoiceNeeded?: boolean;
  invoiceTitle?: string;
  invoiceTaxNo?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
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

export interface DailyStatsItem {
  date: string; // YYYY-MM-DD
  orders: number;
  revenue: number;
}

export interface StatusDistributionItem {
  status: string;
  count: number;
}

export const getOrders = (params: { shop_id: string; status?: string; page: number; pageSize: number }) =>
  request.get('/api/orders', { params }) as Promise<{ items: Order[]; total: number }>;

export const getOrder = (id: string) =>
  request.get(`/api/orders/${id}`) as Promise<Order>;

/** 今日统计（shopId 由后端 JWT 决定） */
export const getOrderStats = (_shopId?: string) =>
  request.get('/api/orders/stats/today') as Promise<OrderStats>;

/** 近 N 天日趋势 */
export const getDailyStats = (_shopId: string | undefined, days = 7) =>
  request.get('/api/orders/stats/daily', { params: { days } }) as Promise<DailyStatsItem[]>;

/** 状态分布 */
export const getStatusDistribution = (_shopId?: string) =>
  request.get('/api/orders/stats/status-distribution') as Promise<StatusDistributionItem[]>;

export const updateOrderStatus = (id: string, status: string) =>
  request.post(`/api/orders/${id}/status`, { status });

// 取消订单：调用专用 /cancel 接口（后端原子处理状态校验 + 退款记录 + daily_stats 联动）
export const cancelOrder = (id: string) =>
  request.post(`/api/orders/${id}/cancel`);

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

export const exportOrders = (params?: { status?: string; maxRows?: number; format?: 'csv' | 'xlsx' | 'both' }) =>
  request.get('/api/orders/export', { params: { format: 'xlsx', ...params } }) as Promise<OrderExportResult>;
