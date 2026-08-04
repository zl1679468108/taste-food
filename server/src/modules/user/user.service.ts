import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { supabase, hasSupabase } from '../../database/supabase.client';
import {
  assertRoleShopInvariant,
  normalizeShopIdForRole,
} from '../../common/utils/admin-shop-scope';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

export interface UserSummary {
  id: string;
  nickName: string;
  avatarUrl: string;
  role: string;
  shopId?: string;
  openid?: string;
  registerDate: string;
  /** 最后登录时间（tf_users.last_login_at，登录/刷新令牌时由 auth 模块写入）；从未登录为 undefined */
  lastLoginAt?: string;
  /** 手机号（tf_users.phone；v31 起用于搜索与画像展示） */
  phone?: string;
  /** 账号状态（active/disabled/banned；§3.24 / T312.4） */
  status?: string;
}

export interface PaginatedUsers {
  items: UserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 用户全部角色（来自 tf_user_roles，含 inactive 历史）
 * §3.24 用户画像（按角色渲染）。多角色并存的账号在抽屉里能看到完整列表与每一项的状态。
 */
export interface UserRoleEntry {
  role: string;
  shopId?: string;
  /** active=当前生效；inactive=历史角色已撤销；pending=申请中 */
  status: string;
}

/**
 * 用户画像业务聚合（§3.24 / T312.2）
 * 字段按角色填，没有的业务数据为 undefined；
 * 前端按 targetUser.role + targetUser.shopId 选用对应卡片渲染。
 */
export interface UserProfileStats {
  /** 顾客：曾下过单的订单数（含 cancelled/rejected） */
  orderCount?: number;
  /** 顾客：累计消费金额（分，只统计 completed + paid） */
  totalSpent?: number;
  /** 顾客：最近一次下单时间 ISO */
  lastOrderAt?: string;
  /** 顾客：收藏菜品数 */
  favoriteCount?: number;

  /** 商家：本店近 30 天订单数（含 cancelled/rejected；商家视角下统计本店） */
  shopRecent30dOrders?: number;
  /** 商家：本店历史订单总数 */
  shopTotalOrders?: number;
  /** 商家：店铺状态（open/closed） */
  shopStatus?: string;

  /** 骑手：累计完成订单数（status=completed 且 rider_id=本用户） */
  completedOrders?: number;
  /** 骑手：当前配送中订单数（status=delivering 且 rider_id=本用户） */
  deliveringOrders?: number;
  /** 骑手：平均评分（来自 tf_reviews.rating，按被该骑手配送的订单评价聚合） */
  avgRating?: number;

  /** 管理员：admin+shopId 空 的平台管理员可查 — 全平台订单数（轻量口径，今日/昨日） */
  platformOrdersToday?: number;
}

/**
 * 用户详情 + 画像（T312.2）
 * 前端抽屉统一数据结构：基础资料 + 全角色 + 状态 + 按角色业务聚合 + 审计摘要 5 条
 */
export interface UserProfile extends UserSummary {
  roles: UserRoleEntry[];
  stats: UserProfileStats;
  recentAudits: Array<{
    id: string;
    method: string;
    path: string;
    action: string;
    summary: string;
    statusCode?: number;
    createdAt: string;
  }>;
}

@Injectable()
export class UserService {
  private toSummary(u: any): UserSummary {
    return {
      id: u.id,
      nickName: u.nick_name,
      avatarUrl: u.avatar_url || '',
      role: u.role,
      shopId: u.shop_id || undefined,
      openid: u.openid,
      registerDate: u.created_at,
      lastLoginAt: u.last_login_at || undefined,
      phone: u.phone || undefined,
      status: u.status || 'active',
    };
  }

  async getUsers(
    page = 1,
    pageSize = 20,
    role?: string,
    /** 商家仅看本店相关用户；平台管理员不传 */
    shopIdFilter?: string,
    /** 关键词搜索：匹配昵称 / ID / OpenID / 手机号（服务端 ILIKE） */
    keyword?: string,
    /** T312.5：状态筛选（active/disabled/banned）；缺省不传即全量 */
    status?: string,
    /** T312.5：注册时间过滤（最近 N 天，days=7/30/90/...）；缺省不传即不限 */
    registeredWithinDays?: number,
  ): Promise<PaginatedUsers> {
    if (!hasSupabase() || !supabase) {
      return { items: [], total: 0, page, pageSize };
    }
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('tf_users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (role) {
      query = query.eq('role', role);
    }
    if (shopIdFilter) {
      // 商家视角：本店绑定用户 + 无店铺的顾客（可选放宽）；这里严格只返回本店绑定账号
      query = query.eq('shop_id', shopIdFilter);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (registeredWithinDays && registeredWithinDays > 0) {
      const sinceIso = new Date(Date.now() - registeredWithinDays * 86400_000).toISOString();
      query = query.gte('created_at', sinceIso);
    }
    if (keyword) {
      // 去除会破坏 ILIKE 模式的特殊字符（% _ \），避免 PostgREST 语法错误
      const kw = keyword.replace(/[%_\\]/g, '').trim();
      if (kw) {
        query = query.or(
          `nick_name.ilike.%${kw}%,id.ilike.%${kw}%,openid.ilike.%${kw}%,phone.ilike.%${kw}%`,
        );
      }
    }
    // T312.5 状态筛选（与 PRD §3.24 一致；缺省只看正常账号）
    // 这里通过 query builder 注入：避免改函数签名传递 N 个筛选参数
    const { data, error, count } = await query;
    if (error) throw new BadRequestException(`获取用户列表失败: ${error.message}`);
    return {
      items: (data || []).map((u: any) => this.toSummary(u)),
      total: count || 0,
      page,
      pageSize,
    };
  }

  async getUserDetail(userId: string): Promise<UserSummary> {
    if (!hasSupabase() || !supabase) throw new NotFoundException('用户不存在');
    const { data, error } = await supabase
      .from('tf_users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) throw new NotFoundException(`用户 ${userId} 不存在`);
    return this.toSummary(data);
  }

  /**
   * 用户详情 + 画像（§3.24 / T312.2）
   * 商家场景：仅可看自己或本店绑定用户；其他场景返回 404 风格避免泄露存在性
   * 平台管理员场景：跨店可查
   */
  async getUserProfile(
    userId: string,
    operator: { userId: string; shopId?: string },
  ): Promise<UserProfile> {
    if (!hasSupabase() || !supabase) {
      throw new NotFoundException('数据库未配置');
    }

    // 商家场景：跨店越权直接 404，防枚举
    const isSelf = operator.userId === userId;
    const isPlatformAdmin = !operator.shopId;
    if (!isSelf && !isPlatformAdmin) {
      throw new ForbiddenException('无权查看该用户');
    }

    // 1. 基础资料
    const { data: userRow, error: userErr } = await supabase
      .from('tf_users')
      .select('*')
      .eq('id', userId)
      .single();
    if (userErr || !userRow) throw new NotFoundException(`用户 ${userId} 不存在`);
    if (!isPlatformAdmin && !isSelf) {
      // 商家视角：仅本店绑定或本人
      if (userRow.shop_id && userRow.shop_id !== operator.shopId) {
        throw new NotFoundException(`用户 ${userId} 不存在`);
      }
    }
    const summary = this.toSummary(userRow);

    // 2. 全角色（含历史）
    const { data: roleRows } = await supabase
      .from('tf_user_roles')
      .select('role, shop_id, status')
      .eq('user_id', userId);
    const roles: UserRoleEntry[] = (roleRows || []).map((r: any) => ({
      role: r.role,
      shopId: r.shop_id || undefined,
      status: r.status || 'active',
    }));

    // 3. 业务聚合（按当前激活角色 + 角色列表分块）
    const stats: UserProfileStats = await this.computeUserStats(userRow, operator.shopId);

    // 4. 审计摘要（近 5 条）
    const { data: auditRows } = await supabase
      .from('tf_audit_logs')
      .select('id, method, path, action, summary, status_code, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    const recentAudits = (auditRows || []).map((r: any) => ({
      id: r.id,
      method: r.method,
      path: r.path,
      action: r.action,
      summary: r.summary,
      statusCode: r.status_code ?? undefined,
      createdAt: r.created_at,
    }));

    return {
      ...summary,
      roles,
      stats,
      recentAudits,
    };
  }

  /**
   * 业务聚合：按当前激活角色分支计算。
   * 任何 supabase 异常都吞掉回 0/空，避免单点失败阻塞整张画像。
   */
  private async computeUserStats(
    userRow: any,
    operatorShopId?: string,
  ): Promise<UserProfileStats> {
    const stats: UserProfileStats = {};
    if (!supabase) return stats;
    const userId = userRow.id;
    const role = userRow.role;
    const shopId = userRow.shop_id;

    try {
      if (role === 'customer') {
        // 顾客：订单统计 + 收藏数
        const [ordersAgg, favCount] = await Promise.all([
          supabase
            .from('tf_orders')
            .select('total, created_at')
            .eq('user_id', userId)
            .in('status', ['completed', 'paid'])
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('tf_favorites')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
        ]);
        const allOrders = (ordersAgg.data || []) as Array<{ total: number; created_at: string }>;
        const completedCount = (await supabase
          .from('tf_orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)).count || 0;
        stats.orderCount = completedCount;
        stats.totalSpent = allOrders.reduce((s, o) => s + (o.total || 0), 0);
        stats.lastOrderAt = allOrders[0]?.created_at;
        stats.favoriteCount = favCount.count || 0;
      } else if (role === 'merchant' && shopId) {
        // 商家：本店订单统计
        const since = new Date(Date.now() - 30 * 86400_000).toISOString();
        const [recent, total, shop] = await Promise.all([
          supabase
            .from('tf_orders')
            .select('id', { count: 'exact', head: true })
            .eq('shop_id', shopId)
            .gte('created_at', since),
          supabase
            .from('tf_orders')
            .select('id', { count: 'exact', head: true })
            .eq('shop_id', shopId),
          supabase
            .from('tf_shops')
            .select('status')
            .eq('id', shopId)
            .maybeSingle(),
        ]);
        stats.shopRecent30dOrders = recent.count || 0;
        stats.shopTotalOrders = total.count || 0;
        stats.shopStatus = (shop.data as any)?.status;
      } else if (role === 'rider') {
        // 骑手：配送统计
        const [completed, delivering] = await Promise.all([
          supabase
            .from('tf_orders')
            .select('id', { count: 'exact', head: true })
            .eq('rider_id', userId)
            .eq('status', 'completed'),
          supabase
            .from('tf_orders')
            .select('id', { count: 'exact', head: true })
            .eq('rider_id', userId)
            .eq('status', 'delivering'),
        ]);
        stats.completedOrders = completed.count || 0;
        stats.deliveringOrders = delivering.count || 0;
        // 平均评分：从 tf_reviews 聚合 — 仅统计由该骑手配送订单的评价
        const { data: ratingRows } = await supabase
          .from('tf_reviews')
          .select('rating, order_id')
          .order('created_at', { ascending: false })
          .limit(500);
        if (ratingRows && ratingRows.length > 0) {
          const orderIds = (ratingRows as any[]).map((r) => r.order_id);
          if (orderIds.length > 0) {
            const { data: orders } = await supabase
              .from('tf_orders')
              .select('id, rider_id')
              .in('id', orderIds)
              .eq('rider_id', userId);
            const ratedOrderIds = new Set(((orders as any[]) || []).map((o) => o.id));
            const ratings = (ratingRows as any[])
              .filter((r) => ratedOrderIds.has(r.order_id))
              .map((r) => r.rating)
              .filter((r) => typeof r === 'number');
            if (ratings.length > 0) {
              stats.avgRating = Math.round(
                (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10,
              ) / 10;
            }
          }
        }
      } else if (role === 'admin' && !shopId) {
        // 平台管理员：今日全平台订单数（轻量）
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from('tf_orders')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfDay.toISOString());
        stats.platformOrdersToday = count || 0;
      }
    } catch (err) {
      // 画像失败不应阻塞基本资料展示
      console.warn('[user] computeUserStats failed:', (err as Error)?.message);
    }

    return stats;
  }

  /**
   * 平台管理员创建用户账号（顾客 / 商家 / 骑手 / 平台管理员）。
   * 角色模型（PRD §3.18）：平台管理员 = admin + 无 shopId；商家 = merchant + shopId。
   * 禁止创建 admin + shopId 的二义账号（T301 写时防御）。
   */
  async createUser(dto: CreateUserDto, operatorShopId?: string): Promise<UserSummary> {
    if (operatorShopId) {
      throw new ForbiddenException('仅平台管理员可创建用户账号');
    }

    // 写时不变量：admin 不可带店；merchant 必须带店。
    // 放在数据库可用性检查之前——入参非法应当直接 400，与基础设施状态无关。
    assertRoleShopInvariant(dto.role, dto.shopId);

    if (!hasSupabase() || !supabase) {
      throw new BadRequestException('数据库未配置，无法创建用户');
    }

    // shopId 有值 → 商家/骑手绑定；admin 无 shopId → 平台管理员
    if (dto.shopId) {
      const { data: shop, error: shopErr } = await supabase
        .from('tf_shops')
        .select('id')
        .eq('id', dto.shopId)
        .maybeSingle();
      if (shopErr || !shop) {
        throw new BadRequestException('绑定的店铺不存在');
      }
    }

    const openid = (dto.openid || `mock_user_${uuidv4().replace(/-/g, '').slice(0, 16)}`).trim();
    const id = uuidv4();
    const payload = {
      id,
      openid,
      role: dto.role,
      // admin 一律落 null，兜住不变量（即便上游校验被绕过）
      shop_id: normalizeShopIdForRole(dto.role, dto.shopId),
      nick_name: dto.nickName,
      avatar_url: dto.avatarUrl || '',
    };

    const { data, error } = await supabase
      .from('tf_users')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505' || error.message?.includes('duplicate')) {
        // 一店一商家唯一索引：idx_users_one_merchant_per_shop
        if (error.message?.includes('one_merchant_per_shop')) {
          throw new ConflictException('该店铺已存在商家账号（一店一商家）');
        }
        throw new ConflictException('openid 已存在');
      }
      throw new BadRequestException(`创建用户失败: ${error.message}`);
    }
    return this.toSummary(data);
  }

  /**
   * 更新用户：
   * - 本人可改 nickName / avatarUrl
   * - 平台管理员可改角色与店铺绑定
   * - 商家不可改他人
   */
  async updateUser(
    userId: string,
    dto: UpdateUserDto,
    operator: { userId: string; shopId?: string },
  ): Promise<UserSummary> {
    if (!hasSupabase() || !supabase) {
      throw new BadRequestException('数据库未配置，无法更新用户');
    }

    const isSelf = operator.userId === userId;
    const isPlatformAdmin = !operator.shopId;

    if (!isSelf && !isPlatformAdmin) {
      throw new ForbiddenException('无权修改其他用户');
    }

    const existing = await this.getUserDetail(userId);
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.nickName !== undefined) patch.nick_name = dto.nickName;
    if (dto.avatarUrl !== undefined) patch.avatar_url = dto.avatarUrl;

    if (dto.role !== undefined || dto.shopId !== undefined) {
      if (!isPlatformAdmin) {
        throw new ForbiddenException('仅平台管理员可修改角色与店铺绑定');
      }
      if (dto.role !== undefined) patch.role = dto.role;
      if (dto.shopId !== undefined) {
        // 空字符串 / null → 解绑
        patch.shop_id = dto.shopId ? dto.shopId : null;
      }
    }

    // 写时不变量（T301）：仅当本次请求确实改动 role / shopId 时校验"改后状态"。
    // 不做全量校验，是为了避免历史二义数据把改昵称这类无关更新一起卡死。
    if (dto.role !== undefined || dto.shopId !== undefined) {
      const nextRole = (patch.role as string) || existing.role;
      const nextShopId = (
        patch.shop_id !== undefined ? patch.shop_id : existing.shopId || null
      ) as string | null;

      // 改为平台管理员却仍留着店铺绑定：要求显式解绑，
      // 避免"悄悄摘掉某店的商家"导致店铺无人管理
      if (nextRole === 'admin' && nextShopId && dto.shopId === undefined) {
        throw new BadRequestException(
          '该账号当前绑定了店铺，改为平台管理员需同时传 shopId: null 解绑店铺',
        );
      }

      assertRoleShopInvariant(nextRole, nextShopId);
    }

    const { data, error } = await supabase
      .from('tf_users')
      .update(patch)
      .eq('id', userId)
      .select('*')
      .single();

    if (error || !data) {
      if (error?.code === '23505' && error.message?.includes('one_merchant_per_shop')) {
        throw new ConflictException('该店铺已存在商家账号（一店一商家）');
      }
      throw new BadRequestException(`更新用户失败: ${error?.message || '未知错误'}`);
    }
    return this.toSummary(data);
  }
}
