import request from '@/utils/request';

export type CustomerSortBy = 'last_order' | 'total_spent' | 'order_count';

/** 商家视角「本店顾客」列表项（§3.24 / T313） */
export interface ShopCustomerSummary {
  id: string;
  nickName: string;
  avatarUrl: string;
  phone?: string;
  /** 账号状态 active/disabled/banned */
  status?: string;
  registerDate: string;
  lastLoginAt?: string;
  /** 本店订单数（全部状态） */
  orderCount: number;
  /** 本店累计消费（分；仅 completed + paid 计入） */
  totalSpent: number;
  /** 客单价（分） */
  avgOrderValue: number;
  /** 本店最近下单时间 ISO */
  lastOrderAt?: string;
}

export interface GetShopCustomersParams {
  page: number;
  pageSize: number;
  keyword?: string;
  sortBy?: CustomerSortBy;
  /** 仅统计最近 N 天内有下单的顾客 */
  hasOrderWithinDays?: number;
}

export interface ShopCustomerOrderItem {
  id: string;
  orderNo?: string;
  total: number;
  status: string;
  createdAt: string;
  itemCount: number;
}

/** 商家视角：单顾客在本店的画像（§3.24 / T313） */
export interface ShopCustomerProfile {
  id: string;
  nickName: string;
  avatarUrl: string;
  phone?: string;
  status?: string;
  registerDate: string;
  lastLoginAt?: string;
  stats: {
    orderCount: number;
    totalSpent: number;
    avgOrderValue: number;
    lastOrderAt?: string;
  };
  recentOrders: ShopCustomerOrderItem[];
}

export const getShopCustomers = (params: GetShopCustomersParams) =>
  request.get('/api/merchant/customers', { params }) as Promise<{
    items: ShopCustomerSummary[];
    total: number;
  }>;

export const getShopCustomerProfile = (id: string) =>
  request.get(`/api/merchant/customers/${id}/profile`) as Promise<ShopCustomerProfile>;
