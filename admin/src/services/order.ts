import request from '@/utils/request';

export interface Order {
  id: string;
  shopId: string;
  userId: string;
  riderId: string;
  status: string;
  total: number;
  deliveryFee: number;
  deliveryType: string;
  address: string;
  tableNo: string;
  remark: string;
  contactName: string;
  contactPhone: string;
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

export const getOrderStats = (shopId: string) =>
  request.get(`/api/orders/stats/${shopId}`) as Promise<OrderStats>;

export const getDailyStats = (shopId: string, days = 7) =>
  request.get(`/api/orders/stats/${shopId}/daily`, { params: { days } }) as Promise<DailyStatsItem[]>;

export const getStatusDistribution = (shopId: string) =>
  request.get(`/api/orders/stats/${shopId}/status-distribution`) as Promise<StatusDistributionItem[]>;

export const updateOrderStatus = (id: string, status: string) =>
  request.post(`/api/orders/${id}/status`, { status });