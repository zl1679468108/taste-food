import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { hashPassword, verifyPassword } from '../../common/utils/password';
import { WechatLoginDto, LoginResponseDto, RegisterDto, PasswordLoginDto } from './dto/auth.dto';
import { TokenService } from './token.service';

interface UserRecord {
  id: string;
  openid: string;
  role: UserRole;
  shopId?: string;
  nickName: string;
  avatarUrl: string;
  username?: string;
  passwordHash?: string;
  phone?: string;
  createdAt: string;
}

interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  refreshTokenHash: string;
  refreshExpiresAt: string;
  createdAt: string;
}

const memoryUsers: Map<string, UserRecord> = new Map();
const openidToUser: Map<string, UserRecord> = new Map();
/** 开发环境会话回退：sessionId -> session */
const memorySessions: Map<string, SessionRecord> = new Map();
/** access hash -> sessionId */
const memoryAccessIndex: Map<string, string> = new Map();
/** refresh hash -> sessionId */
const memoryRefreshIndex: Map<string, string> = new Map();

const DEV_MOCK_USERS: Record<
  string,
  { openid: string; role: UserRole; nickName: string; shopId?: string | null }
> = {
  // 平台管理员：shopId 显式 null，可跨店管理
  admin_code: {
    openid: 'mock_platform_admin_openid_001',
    role: UserRole.ADMIN,
    nickName: '平台管理员',
    shopId: null,
  },
  // 兼容旧登录码
  platform_admin_code: {
    openid: 'mock_platform_admin_openid_001',
    role: UserRole.ADMIN,
    nickName: '平台管理员',
    shopId: null,
  },
  // 单店商家
  merchant_code: {
    openid: 'mock_merchant_openid_001',
    role: UserRole.ADMIN,
    nickName: '商家管理员',
    shopId: DEFAULT_SHOP_ID,
  },
  customer_code: {
    openid: 'mock_customer_openid_001',
    role: UserRole.CUSTOMER,
    nickName: '测试顾客',
  },
  rider_code: {
    openid: 'mock_rider_openid_001',
    role: UserRole.RIDER,
    nickName: '测试骑手',
    // 骑手不绑定单店，可跨店抢单
  },
};

const isProduction = process.env.NODE_ENV === 'production';
/** 平台管理员 openid：不绑定 shop，可跨店 */
const PLATFORM_ADMIN_OPENIDS = new Set([
  'mock_platform_admin_openid_001',
]);
const MAX_SESSIONS_PER_USER = 5;

const initMemoryUsers = () => {
  if (memoryUsers.size > 0) return;

  const adminId = uuidv4();
  const adminOpenid = 'mock_platform_admin_openid_001';
  const admin: UserRecord = {
    id: adminId,
    openid: adminOpenid,
    role: UserRole.ADMIN,
    shopId: undefined, // 平台管理员跨店
    nickName: '平台管理员',
    avatarUrl: '',
    createdAt: '2025-06-01T00:00:00Z',
  };
  memoryUsers.set(adminId, admin);
  openidToUser.set(adminOpenid, admin);

  const merchantId = uuidv4();
  const merchantOpenid = 'mock_merchant_openid_001';
  const merchant: UserRecord = {
    id: merchantId,
    openid: merchantOpenid,
    role: UserRole.ADMIN,
    shopId: DEFAULT_SHOP_ID,
    nickName: '商家管理员',
    avatarUrl: '',
    createdAt: '2025-06-01T00:00:00Z',
  };
  memoryUsers.set(merchantId, merchant);
  openidToUser.set(merchantOpenid, merchant);

  const customerId = uuidv4();
  const customerOpenid = 'mock_customer_openid_001';
  const customer: UserRecord = {
    id: customerId,
    openid: customerOpenid,
    role: UserRole.CUSTOMER,
    nickName: '测试顾客',
    avatarUrl: '',
    createdAt: '2025-06-01T00:00:00Z',
  };
  memoryUsers.set(customerId, customer);
  openidToUser.set(customerOpenid, customer);

  const riderId = uuidv4();
  const riderOpenid = 'mock_rider_openid_001';
  const rider: UserRecord = {
    id: riderId,
    openid: riderOpenid,
    role: UserRole.RIDER,
    nickName: '测试骑手',
    avatarUrl: '',
    createdAt: '2025-06-01T00:00:00Z',
  };
  memoryUsers.set(riderId, rider);
  openidToUser.set(riderOpenid, rider);
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly tokenService: TokenService) {
    initMemoryUsers();
  }

  /**
   * admin（商家）若未绑定店铺，补 DEFAULT_SHOP_ID。
   * 平台管理员可保持 shopId 为空以跨店查看（由上层传入 null 且 role 语义区分）。
   * 骑手不强制绑定店铺，支持跨店取餐。
   * customer 保持无 shopId。
   */
  private isPlatformAdmin(openid: string, role: UserRole, shopId?: string | null): boolean {
    if (role !== UserRole.ADMIN) return false;
    if (PLATFORM_ADMIN_OPENIDS.has(openid)) return true;
    // shopId 显式 null 视为平台管理员
    return shopId === null;
  }

  private normalizeShopId(
    role: UserRole,
    shopId?: string | null,
    openid?: string,
  ): string | undefined {
    if (role === UserRole.ADMIN) {
      // 平台管理员始终不绑店
      if (openid && this.isPlatformAdmin(openid, role, shopId)) return undefined;
      if (shopId === null || shopId === undefined || shopId === '') return undefined;
      // 历史误把商家写成 admin 的兼容：有 shopId 则保留
      return shopId;
    }
    if (role === UserRole.MERCHANT) {
      return shopId || DEFAULT_SHOP_ID;
    }
    if (role === UserRole.RIDER || role === UserRole.CUSTOMER) {
      return shopId || undefined;
    }
    return shopId || undefined;
  }

  private toPayload(user: UserRecord): CurrentUserPayload {
    return {
      userId: user.id,
      openid: user.openid,
      role: user.role,
      shopId: this.normalizeShopId(user.role, user.shopId, user.openid),
    };
  }

  private toUserRecord(data: {
    id: string;
    openid: string;
    role: string;
    shop_id?: string | null;
    nick_name?: string;
    avatar_url?: string;
    created_at?: string;
  }): UserRecord {
    const role = data.role as UserRole;
    return {
      id: data.id,
      openid: data.openid,
      role,
      shopId: this.normalizeShopId(role, data.shop_id, data.openid),
      nickName: data.nick_name || '',
      avatarUrl: data.avatar_url || '',
      username: (data as any).username || undefined,
      passwordHash: (data as any).password_hash || undefined,
      phone: (data as any).phone || undefined,
      createdAt: data.created_at || new Date().toISOString(),
    };
  }

  /** 商家 admin 无 shopId 时补 DEFAULT_SHOP_ID（内存 + 尽量回写 DB）；骑手不强制绑店 */
  private async ensureAdminShopBinding(user: UserRecord): Promise<UserRecord> {
    const shopId = this.normalizeShopId(user.role, user.shopId, user.openid);
    const next: UserRecord = { ...user, shopId };
    memoryUsers.set(next.id, next);
    openidToUser.set(next.openid, next);

    const needWrite =
      !!shopId &&
      !user.shopId &&
      user.role === UserRole.ADMIN &&
      hasSupabase() &&
      !!supabase;
    if (needWrite && supabase) {
      try {
        const { error } = await supabase
          .from('tf_users')
          .update({ shop_id: shopId })
          .eq('id', user.id)
          .is('shop_id', null);
        if (error) {
          this.logger.warn(`[Auth] 回写 admin shopId 失败: ${error.message}`);
        }
      } catch (e) {
        this.logger.warn(
          `[Auth] 回写 admin shopId 异常: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    return next;
  }

  private rememberMemorySession(session: SessionRecord) {
    memorySessions.set(session.id, session);
    memoryAccessIndex.set(session.tokenHash, session.id);
    memoryRefreshIndex.set(session.refreshTokenHash, session.id);
  }

  private forgetMemorySession(session: SessionRecord) {
    memorySessions.delete(session.id);
    if (memoryAccessIndex.get(session.tokenHash) === session.id) {
      memoryAccessIndex.delete(session.tokenHash);
    }
    if (memoryRefreshIndex.get(session.refreshTokenHash) === session.id) {
      memoryRefreshIndex.delete(session.refreshTokenHash);
    }
  }

  /** 限制同一用户活跃会话数量（内存） */
  private trimMemorySessions(userId: string) {
    const list = [...memorySessions.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (list.length <= MAX_SESSIONS_PER_USER) return;
    for (const old of list.slice(MAX_SESSIONS_PER_USER)) {
      this.forgetMemorySession(old);
    }
  }

  /** 限制同一用户活跃会话数量（数据库，按 created_at 倒序保留 N 条） */
  private async trimDbSessions(userId: string) {
    if (!hasSupabase() || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('tf_user_sessions')
        .select('id, created_at')
        .eq('user_id', userId)
        .gt('refresh_expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error || !data || data.length <= MAX_SESSIONS_PER_USER) return;
      const toDelete = data.slice(MAX_SESSIONS_PER_USER).map((r) => r.id);
      if (toDelete.length > 0) {
        await supabase.from('tf_user_sessions').delete().in('id', toDelete);
      }
    } catch (e) {
      this.logger.warn(
        `[Auth] 裁剪会话失败: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  /**
   * 创建会话，返回给前端的仍是 token + refreshToken 字段名（兼容现有 admin/client）。
   * token = opaque access；refreshToken = opaque refresh。
   */
  private async createSession(userId: string): Promise<{ token: string; refreshToken: string }> {
    const accessToken = this.tokenService.generateAccessToken();
    const refreshToken = this.tokenService.generateRefreshToken();
    const accessHash = this.tokenService.hashToken(accessToken);
    const refreshHash = this.tokenService.hashToken(refreshToken);
    const now = new Date().toISOString();
    const expiresAt = this.tokenService.getAccessExpiresAt();
    const refreshExpiresAt = this.tokenService.getRefreshExpiresAt();
    const sessionId = uuidv4();

    if (hasSupabase() && supabase) {
      const { error } = await supabase.from('tf_user_sessions').insert({
        id: sessionId,
        user_id: userId,
        token_hash: accessHash,
        expires_at: expiresAt,
        refresh_token_hash: refreshHash,
        refresh_expires_at: refreshExpiresAt,
        created_at: now,
      });
      if (error) {
        // 表缺失时降级内存，避免登录全挂
        this.logger.error(`[Auth] 创建会话失败，回退内存: ${error.message}`);
        assertMemoryFallbackAllowed('AuthService.createSession');
        this.rememberMemorySession({
          id: sessionId,
          userId,
          tokenHash: accessHash,
          expiresAt,
          refreshTokenHash: refreshHash,
          refreshExpiresAt,
          createdAt: now,
        });
        this.trimMemorySessions(userId);
      } else {
        await this.trimDbSessions(userId);
      }
    } else {
      assertMemoryFallbackAllowed('AuthService.createSession');
      this.rememberMemorySession({
        id: sessionId,
        userId,
        tokenHash: accessHash,
        expiresAt,
        refreshTokenHash: refreshHash,
        refreshExpiresAt,
        createdAt: now,
      });
      this.trimMemorySessions(userId);
    }

    return { token: accessToken, refreshToken };
  }

  private async issueLoginResponse(user: UserRecord): Promise<LoginResponseDto> {
    const bound = await this.ensureAdminShopBinding(user);
    const payload = this.toPayload(bound);
    const tokens = await this.createSession(bound.id);
    const roles = await this.listUserRoles(bound.id, bound);
    return {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      userId: bound.id,
      openid: bound.openid,
      role: bound.role,
      shopId: payload.shopId,
      nickName: bound.nickName,
      username: bound.username,
      phone: bound.phone,
      roles,
    };
  }

  private async listUserRoles(
    userId: string,
    fallback?: UserRecord,
  ): Promise<Array<{ role: string; shopId?: string | null; status: string }>> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_user_roles')
        .select('role, shop_id, status')
        .eq('user_id', userId)
        .eq('status', 'active');
      if (!error && data && data.length) {
        return data.map((r) => ({
          role: r.role,
          shopId: r.shop_id,
          status: r.status || 'active',
        }));
      }
    }
    if (fallback) {
      return [
        {
          role: fallback.role,
          shopId: fallback.shopId || null,
          status: 'active',
        },
      ];
    }
    return [];
  }

  async register(dto: RegisterDto): Promise<LoginResponseDto> {
    const username = dto.username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      throw new BadRequestException('用户名需为 3-32 位字母数字下划线');
    }
    const passwordHash = hashPassword(dto.password);
    const openid = `pwd_${username}`;
    const nickName = dto.nickName?.trim() || username;
    const phone = dto.phone?.trim();

    // 始终先注册为顾客
    if (hasSupabase() && supabase) {
      const { data: existed } = await supabase
        .from('tf_users')
        .select('id')
        .or(`username.eq.${username},openid.eq.${openid}`)
        .maybeSingle();
      if (existed) throw new BadRequestException('用户名已存在');

      const id = uuidv4();
      const { data, error } = await supabase
        .from('tf_users')
        .insert({
          id,
          openid,
          username,
          password_hash: passwordHash,
          role: UserRole.CUSTOMER,
          nick_name: nickName,
          phone: phone || null,
          avatar_url: '',
        })
        .select('*')
        .single();
      if (error || !data) {
        this.logger.warn(`[Auth] register db failed: ${error?.message}`);
        // fallthrough memory
      } else {
        await supabase.from('tf_user_roles').insert({
          user_id: id,
          role: UserRole.CUSTOMER,
          status: 'active',
        });
        const user = this.toUserRecord({
          ...data,
          password_hash: passwordHash,
          username,
        });
        return this.issueLoginResponse(user);
      }
    }

    assertMemoryFallbackAllowed('AuthService');
    if ([...openidToUser.values()].some((u) => u.username === username || u.openid === openid)) {
      throw new BadRequestException('用户名已存在');
    }
    const id = uuidv4();
    const user: UserRecord = {
      id,
      openid,
      username,
      passwordHash,
      role: UserRole.CUSTOMER,
      nickName,
      phone,
      avatarUrl: '',
      createdAt: new Date().toISOString(),
    };
    memoryUsers.set(id, user);
    openidToUser.set(openid, user);
    return this.issueLoginResponse(user);
  }

  async passwordLogin(dto: PasswordLoginDto): Promise<LoginResponseDto> {
    const username = dto.username.trim().toLowerCase();
    let user: UserRecord | null = null;

    if (hasSupabase() && supabase) {
      const { data } = await supabase
        .from('tf_users')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      if (data) {
        user = this.toUserRecord(data);
        user.passwordHash = data.password_hash;
        user.username = data.username;
        user.phone = data.phone;
      }
    }
    if (!user) {
      assertMemoryFallbackAllowed('AuthService');
      user = [...memoryUsers.values()].find((u) => u.username === username) || null;
    }
    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      // 兼容种子 SEED_PENDING：自动写入 merchant123
      if (user && user.passwordHash === 'SEED_PENDING' && dto.password === 'merchant123') {
        const hash = hashPassword('merchant123');
        user.passwordHash = hash;
        if (hasSupabase() && supabase) {
          await supabase.from('tf_users').update({ password_hash: hash }).eq('id', user.id);
        }
        memoryUsers.set(user.id, user);
      } else {
        throw new UnauthorizedException('用户名或密码错误');
      }
    }
    return this.issueLoginResponse(user);
  }

  async getProfile(userId: string) {
    const user = await this.getUserById(userId);
    if (!user) throw new UnauthorizedException('用户不存在');
    const roles = await this.listUserRoles(userId, user);
    return {
      userId: user.id,
      openid: user.openid,
      role: user.role,
      shopId: user.shopId,
      nickName: user.nickName,
      username: user.username,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      roles,
    };
  }

  async switchRole(
    userId: string,
    role: string,
    shopId?: string,
  ): Promise<LoginResponseDto> {
    const user = await this.getUserById(userId);
    if (!user) throw new UnauthorizedException('用户不存在');

    const roles = await this.listUserRoles(userId, user);
    const allowed = roles.some((r) => r.role === role && r.status === 'active');
    // 平台管理员可切 admin；种子用户可能无 roles 表
    const isSelfAdmin = user.role === UserRole.ADMIN && role === UserRole.ADMIN;
    if (!allowed && !isSelfAdmin && user.role !== role) {
      // 若 roles 表空但当前 role 匹配
      if (!(roles.length === 0 && user.role === role)) {
        throw new ForbiddenException('无权切换到该角色');
      }
    }

    let nextShopId: string | undefined = undefined;
    if (role === UserRole.MERCHANT) {
      nextShopId = shopId || roles.find((r) => r.role === 'merchant')?.shopId || user.shopId;
      if (!nextShopId) throw new BadRequestException('商家角色缺少绑定店铺');
    }

    if (hasSupabase() && supabase) {
      const { error } = await supabase
        .from('tf_users')
        .update({ role, shop_id: nextShopId || null })
        .eq('id', userId);
      if (error) throw new BadRequestException(`切换角色失败: ${error.message}`);
    }

    const next: UserRecord = {
      ...user,
      role: role as UserRole,
      shopId: nextShopId,
    };
    memoryUsers.set(userId, next);
    openidToUser.set(next.openid, next);
    return this.issueLoginResponse(next);
  }

  async ensureDemoMerchant(): Promise<{ username: string; password: string; shopId: string }> {
    const username = 'merchant';
    const password = 'merchant123';
    const hash = hashPassword(password);
    const id = 'b0000000-0000-0000-0000-000000000001';
    const openid = 'pwd_merchant_demo';
    const shopId = DEFAULT_SHOP_ID;

    if (hasSupabase() && supabase) {
      const { data } = await supabase.from('tf_users').select('id').eq('id', id).maybeSingle();
      if (data) {
        await supabase
          .from('tf_users')
          .update({
            username,
            password_hash: hash,
            role: UserRole.MERCHANT,
            shop_id: shopId,
            nick_name: '测试商家',
          })
          .eq('id', id);
      } else {
        await supabase.from('tf_users').insert({
          id,
          openid,
          username,
          password_hash: hash,
          role: UserRole.MERCHANT,
          shop_id: shopId,
          nick_name: '测试商家',
          phone: '13800000001',
        });
      }
      await supabase.from('tf_user_roles').upsert(
        [
          { user_id: id, role: UserRole.MERCHANT, shop_id: shopId, status: 'active' },
          { user_id: id, role: UserRole.CUSTOMER, shop_id: null, status: 'active' },
        ],
        { onConflict: 'user_id,role,shop_id' },
      );
    }

    const user: UserRecord = {
      id,
      openid,
      username,
      passwordHash: hash,
      role: UserRole.MERCHANT,
      shopId,
      nickName: '测试商家',
      phone: '13800000001',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
    };
    memoryUsers.set(id, user);
    openidToUser.set(openid, user);
    return { username, password, shopId };
  }


  /**
   * 调用微信 code2Session 接口校验 code 并获取真实 openid。
   */
  private async code2Session(code: string): Promise<{ openid: string }> {
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;
    if (!appid || !secret) {
      throw new BadRequestException('未配置 WX_APPID / WX_SECRET');
    }
    const url =
      `https://api.weixin.qq.com/sns/jscode2session` +
      `?appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      `&grant_type=authorization_code`;
    const resp = await fetch(url);
    const data = (await resp.json()) as { openid?: string; errcode?: number; errmsg?: string };
    if (!data.openid) {
      this.logger.error(`微信 code2Session 失败: errcode=${data.errcode} errmsg=${data.errmsg}`);
      throw new UnauthorizedException('微信登录失败，请重试');
    }
    return { openid: data.openid };
  }


  async wechatLogin(dto: WechatLoginDto): Promise<LoginResponseDto> {
    let openid: string;
    let nickName: string;
    let role: UserRole = UserRole.CUSTOMER;
    let shopId: string | null | undefined;

    if (isProduction) {
      // 生产环境：真实微信 API；角色由数据库记录决定
      const session = await this.code2Session(dto.code);
      openid = session.openid;
      nickName = dto.nickName || `顾客${openid.substring(openid.length - 4)}`;
    } else {
      const mockUser = DEV_MOCK_USERS[dto.code];
      if (mockUser) {
        openid = mockUser.openid;
        nickName = dto.nickName || mockUser.nickName;
        role = mockUser.role;
        shopId = mockUser.shopId;
      } else if (process.env.WX_APPID && process.env.WX_SECRET) {
        const session = await this.code2Session(dto.code);
        openid = session.openid;
        nickName = dto.nickName || `顾客${openid.substring(openid.length - 4)}`;
      } else {
        openid = `mock_openid_${dto.code || uuidv4().substring(0, 8)}`;
        nickName = dto.nickName || `顾客${openid.substring(openid.length - 4)}`;
      }
    }

    if (hasSupabase() && supabase) {
      let user = await this.findUserByOpenidDb(openid);
      if (!user) {
        const { data, error } = await supabase
          .from('tf_users')
          .insert({
            id: uuidv4(),
            openid,
            role,
            shop_id: shopId || null,
            nick_name: nickName,
            avatar_url: dto.avatarUrl || '',
          })
          .select('*')
          .single();
        if (error) {
          return this.wechatLoginMemory(openid, nickName, dto, role, shopId);
        }
        user = this.toUserRecord(data);
      }
      // 已存在用户不根据 code 覆盖角色，防止客户端提权
      if (shopId && !user.shopId) {
        user = { ...user, shopId };
      }
      return this.issueLoginResponse(user);
    }

    return this.wechatLoginMemory(openid, nickName, dto, role, shopId);
  }

  private async wechatLoginMemory(
    openid: string,
    nickName: string,
    dto: WechatLoginDto,
    role: UserRole = UserRole.CUSTOMER,
    shopId?: string | null,
  ): Promise<LoginResponseDto> {
    assertMemoryFallbackAllowed('AuthService');
    let user = openidToUser.get(openid);
    if (!user) {
      const id = uuidv4();
      user = {
        id,
        openid,
        role,
        shopId: shopId === null ? undefined : shopId,
        nickName,
        avatarUrl: dto.avatarUrl || '',
        createdAt: new Date().toISOString(),
      };
      memoryUsers.set(id, user);
      openidToUser.set(openid, user);
    }
    // 已存在内存用户不覆盖角色
    if (shopId && !user.shopId) {
      user = { ...user, shopId };
      memoryUsers.set(user.id, user);
      openidToUser.set(openid, user);
    }
    return this.issueLoginResponse(user);
  }

  private async findUserByOpenidDb(openid: string): Promise<UserRecord | null> {
    if (!hasSupabase() || !supabase) return null;
    const { data, error } = await supabase
      .from('tf_users')
      .select('*')
      .eq('openid', openid)
      .single();
    if (error || !data) return null;
    return this.toUserRecord(data);
  }

  /**
   * 校验 Access Token（opaque）：hash 查会话表，未过期则返回用户载荷。
   */
  async validateToken(token: string): Promise<CurrentUserPayload> {
    if (!token || !String(token).trim()) {
      throw new UnauthorizedException('无效的 token');
    }
    const accessHash = this.tokenService.hashToken(token.trim());
    const now = Date.now();

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_user_sessions')
        .select('user_id, expires_at')
        .eq('token_hash', accessHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!error && data?.user_id) {
        const user = await this.getUserById(String(data.user_id));
        if (!user) {
          throw new UnauthorizedException('用户不存在');
        }
        return this.toPayload(user);
      }

      // 表不存在等错误：尝试内存回退（开发）
      if (error && !/does not exist|PGRST/i.test(error.message)) {
        this.logger.warn(`[Auth] 校验 access 会话失败: ${error.message}`);
      }
    }

    const sessionId = memoryAccessIndex.get(accessHash);
    const session = sessionId ? memorySessions.get(sessionId) : undefined;
    if (!session || new Date(session.expiresAt).getTime() <= now) {
      throw new UnauthorizedException('无效的 token 或已过期');
    }
    const user = await this.getUserById(session.userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return this.toPayload(user);
  }

  /**
   * 用 Refresh 换发新的 Access（默认不轮换 refresh，对齐 family-bookkeeping）。
   * 返回字段仍为 token + refreshToken，兼容现有前端。
   */
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ token: string; refreshToken: string }> {
    if (!refreshToken || !String(refreshToken).trim()) {
      throw new UnauthorizedException('无效的 refresh token');
    }
    const refreshHash = this.tokenService.hashToken(refreshToken.trim());
    const nowIso = new Date().toISOString();

    // DB 优先
    if (hasSupabase() && supabase) {
      const { data: session, error } = await supabase
        .from('tf_user_sessions')
        .select('id, user_id, refresh_expires_at')
        .eq('refresh_token_hash', refreshHash)
        .gt('refresh_expires_at', nowIso)
        .maybeSingle();

      if (!error && session?.user_id) {
        const user = await this.getUserById(String(session.user_id));
        if (!user) {
          throw new UnauthorizedException('用户不存在');
        }
        const accessToken = this.tokenService.generateAccessToken();
        const accessHash = this.tokenService.hashToken(accessToken);
        const expiresAt = this.tokenService.getAccessExpiresAt();
        const { error: updateError } = await supabase
          .from('tf_user_sessions')
          .update({
            token_hash: accessHash,
            expires_at: expiresAt,
          })
          .eq('id', session.id);
        if (updateError) {
          this.logger.error(`[Auth] 刷新 access 失败: ${updateError.message}`);
          throw new UnauthorizedException('刷新令牌失败，请重新登录');
        }
        return { token: accessToken, refreshToken };
      }

      if (error && !/does not exist|PGRST/i.test(error.message || '')) {
        this.logger.warn(`[Auth] 查询 refresh 会话失败: ${error.message}`);
      }
    }

    // 内存回退
    const sessionId = memoryRefreshIndex.get(refreshHash);
    const session = sessionId ? memorySessions.get(sessionId) : undefined;
    if (!session || new Date(session.refreshExpiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException('刷新令牌无效或已过期，请重新登录');
    }
    const user = await this.getUserById(session.userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 更新 access hash 索引
    if (memoryAccessIndex.get(session.tokenHash) === session.id) {
      memoryAccessIndex.delete(session.tokenHash);
    }
    const accessToken = this.tokenService.generateAccessToken();
    const accessHash = this.tokenService.hashToken(accessToken);
    session.tokenHash = accessHash;
    session.expiresAt = this.tokenService.getAccessExpiresAt();
    memorySessions.set(session.id, session);
    memoryAccessIndex.set(accessHash, session.id);

    return { token: accessToken, refreshToken };
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_users')
        .select('*')
        .eq('id', userId)
        .single();
      if (error || !data) {
        // 可能是内存 mock 用户
        const mem = memoryUsers.get(userId);
        if (mem) {
          return {
            ...mem,
            shopId: this.normalizeShopId(mem.role, mem.shopId, mem.openid),
          };
        }
        return null;
      }
      return this.toUserRecord(data);
    }
    const user = memoryUsers.get(userId);
    if (!user) return null;
    return {
      ...user,
      shopId: this.normalizeShopId(user.role, user.shopId, user.openid),
    };
  }
}
