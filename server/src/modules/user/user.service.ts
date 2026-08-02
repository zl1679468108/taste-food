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
}

export interface PaginatedUsers {
  items: UserSummary[];
  total: number;
  page: number;
  pageSize: number;
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
    };
  }

  async getUsers(
    page = 1,
    pageSize = 20,
    role?: string,
    /** 商家仅看本店相关用户；平台管理员不传 */
    shopIdFilter?: string,
    /** 关键词搜索：匹配昵称 / ID / OpenID（服务端 ILIKE） */
    keyword?: string,
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
    if (keyword) {
      // 去除会破坏 ILIKE 模式的特殊字符（% _ \），避免 PostgREST 语法错误
      const kw = keyword.replace(/[%_\\]/g, '').trim();
      if (kw) {
        query = query.or(
          `nick_name.ilike.%${kw}%,id.ilike.%${kw}%,openid.ilike.%${kw}%`,
        );
      }
    }
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
