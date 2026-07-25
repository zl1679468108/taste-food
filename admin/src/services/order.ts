import request from '@/utils/request';

export interface Order {
  id: string;
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

/** 导出订单 CSV（服务端生成，最多 maxRows） */
export const exportOrders = (params?: { status?: string; maxRows?: number }) =>
  request.get('/api/orders/export', { params }) as Promise<{
    csv: string;
    count: number;
    filename: string;
  }>;
