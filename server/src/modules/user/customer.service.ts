import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { supabase, hasSupabase } from '../../database/supabase.client';

/**
 * 商家视角「顾客管理」数据服务（§3.24 / T313）
 * 与平台「用户管理」区分：本店顾客 = 曾在本店（shop_id = 当前商家店铺）下过单的用户，
 * 不再只是「本店绑定账号」。聚合维度围绕本店订单，而非账号本身。
 */

export interface ShopCustomerSummary {
  id: string;
  nickName: string;
  avatarUrl: string;
  phone?: string;
  /** 账号状态（active/disabled/banned） */
  status?: string;
  registerDate: string;
  lastLoginAt?: string;
  /** 本店订单数（全部状态） */
  orderCount: number;
  /** 本店累计消费（分；仅 completed + paid 计入） */
  totalSpent: number;
  /** 客单价（分）= totalSpent / orderCount；无单为 0 */
  avgOrderValue: number;
  /** 本店最近一次下单时间 ISO */
  lastOrderAt?: string;
}

export interface PaginatedShopCustomers {
  items: ShopCustomerSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ShopCustomerOrderItem {
  id: string;
  orderNo?: string;
  total: number;
  status: string;
  createdAt: string;
  itemCount: number;
}

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
  /** 该顾客在本店的最近订单（最多 20 条） */
  recentOrders: ShopCustomerOrderItem[];
}

export type CustomerSortBy = 'last_order' | 'total_spent' | 'order_count';

const ORDER_FETCH_CAP = 5000;

@Injectable()
export class CustomerService {
  /**
   * 商家视角：本店顾客列表（曾在本店下过单的用户）。
   * 聚合策略：拉取本店订单（限 ORDER_FETCH_CAP），在 JS 侧按 user_id 聚合，
   * 再取用户资料做关键词过滤 / 排序 / 分页。适用于单店订单量适中场景。
   */
  async getShopCustomers(
    shopId: string | undefined,
    opts: {
      page?: number;
      pageSize?: number;
      keyword?: string;
      sortBy?: CustomerSortBy;
      hasOrderWithinDays?: number;
    },
  ): Promise<PaginatedShopCustomers> {
    const page = Math.max(1, opts.page || 1);
    const pageSize = Math.max(1, opts.pageSize || 20);
    const sortBy = opts.sortBy || 'last_order';
    if (!shopId) return { items: [], total: 0, page, pageSize };
    if (!hasSupabase() || !supabase) return { items: [], total: 0, page, pageSize };

    // 1) 拉取本店订单并聚合到用户
    const { data: orderRows } = await supabase
      .from('tf_orders')
      .select('user_id, total, created_at, status')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(ORDER_FETCH_CAP);

    const sinceFilter =
      opts.hasOrderWithinDays && opts.hasOrderWithinDays > 0
        ? new Date(Date.now() - opts.hasOrderWithinDays * 86400_000).toISOString()
        : null;

    const agg = new Map<string, { orderCount: number; totalSpent: number; lastOrderAt?: string }>();
    for (const o of (orderRows as any[]) || []) {
      if (!o.user_id) continue;
      if (sinceFilter && o.created_at < sinceFilter) continue; // 仅纳入时间窗口内订单
      const cur =
        agg.get(o.user_id) || { orderCount: 0, totalSpent: 0, lastOrderAt: undefined };
      cur.orderCount += 1;
      if (o.status === 'completed' || o.status === 'paid') cur.totalSpent += o.total || 0;
      if (!cur.lastOrderAt || o.created_at > cur.lastOrderAt) cur.lastOrderAt = o.created_at;
      agg.set(o.user_id, cur);
    }

    let userIds = Array.from(agg.keys());
    if (userIds.length === 0) return { items: [], total: 0, page, pageSize };

    // 2) 拉取用户资料
    const { data: userRows } = await supabase
      .from('tf_users')
      .select('id, nick_name, avatar_url, phone, status, created_at, last_login_at')
      .in('id', userIds);

    const userMap = new Map<string, any>();
    for (const u of (userRows as any[]) || []) userMap.set(u.id, u);

    // 3) 关键词过滤（昵称 / 手机号）
    const kw = opts.keyword ? opts.keyword.replace(/[%_\\]/g, '').trim().toLowerCase() : '';
    let merged: ShopCustomerSummary[] = userIds
      .map((id) => {
        const u = userMap.get(id);
        const a = agg.get(id)!;
        return {
          id,
          nickName: u?.nick_name || '未命名用户',
          avatarUrl: u?.avatar_url || '',
          phone: u?.phone || undefined,
          status: u?.status || 'active',
          registerDate: u?.created_at || '',
          lastLoginAt: u?.last_login_at || undefined,
          orderCount: a.orderCount,
          totalSpent: a.totalSpent,
          avgOrderValue: a.orderCount ? Math.round(a.totalSpent / a.orderCount) : 0,
          lastOrderAt: a.lastOrderAt,
        } as ShopCustomerSummary;
      })
      .filter((c) => {
        if (!kw) return true;
        return (
          (c.nickName || '').toLowerCase().includes(kw) ||
          (c.phone || '').includes(kw)
        );
      });

    // 4) 排序
    merged = merged.sort((a, b) => {
      if (sortBy === 'total_spent') return b.totalSpent - a.totalSpent;
      if (sortBy === 'order_count') return b.orderCount - a.orderCount;
      const ta = a.lastOrderAt ? Date.parse(a.lastOrderAt) : 0;
      const tb = b.lastOrderAt ? Date.parse(b.lastOrderAt) : 0;
      return tb - ta;
    });

    const total = merged.length;
    const from = (page - 1) * pageSize;
    const items = merged.slice(from, from + pageSize);
    return { items, total, page, pageSize };
  }

  /**
   * 商家视角：单顾客在本店的画像 + 最近订单。
   * 注：平台管理员不应访问此接口（仅 MERCHANT）；shopId 为空直接 400。
   */
  async getShopCustomerProfile(
    shopId: string | undefined,
    userId: string,
  ): Promise<ShopCustomerProfile> {
    if (!shopId) throw new BadRequestException('店铺未绑定');
    if (!hasSupabase() || !supabase) throw new NotFoundException('数据库未配置');

    const { data: userRow, error } = await supabase
      .from('tf_users')
      .select('id, nick_name, avatar_url, phone, status, created_at, last_login_at')
      .eq('id', userId)
      .single();
    if (error || !userRow) throw new NotFoundException(`用户 ${userId} 不存在`);

    // 本店订单聚合 + 最近订单
    const { data: orders } = await supabase
      .from('tf_orders')
      .select('id, order_no, total, status, created_at')
      .eq('shop_id', shopId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    const orderList = (orders as any[]) || [];
    const paidOrders = orderList.filter(
      (o) => o.status === 'completed' || o.status === 'paid',
    );
    const totalSpent = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
    const orderCount = orderList.length;
    const lastOrderAt = orderList[0]?.created_at;

    // 各订单 item 数量
    const orderIds = orderList.map((o) => o.id);
    const itemCountMap = new Map<string, number>();
    if (orderIds.length) {
      const { data: items } = await supabase
        .from('tf_order_items')
        .select('order_id, quantity')
        .in('order_id', orderIds);
      for (const it of (items as any[]) || []) {
        itemCountMap.set(
          it.order_id,
          (itemCountMap.get(it.order_id) || 0) + (it.quantity || 0),
        );
      }
    }

    const recentOrders: ShopCustomerOrderItem[] = orderList.map((o) => ({
      id: o.id,
      orderNo: o.order_no || undefined,
      total: o.total || 0,
      status: o.status,
      createdAt: o.created_at,
      itemCount: itemCountMap.get(o.id) || 0,
    }));

    return {
      id: userRow.id,
      nickName: userRow.nick_name || '未命名用户',
      avatarUrl: userRow.avatar_url || '',
      phone: userRow.phone || undefined,
      status: userRow.status || 'active',
      registerDate: userRow.created_at,
      lastLoginAt: userRow.last_login_at || undefined,
      stats: {
        orderCount,
        totalSpent,
        avgOrderValue: orderCount ? Math.round(totalSpent / orderCount) : 0,
        lastOrderAt,
      },
      recentOrders,
    };
  }
}
