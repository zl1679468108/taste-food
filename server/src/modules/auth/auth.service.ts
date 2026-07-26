import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { WechatLoginDto, LoginResponseDto } from './dto/auth.dto';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { TokenService } from './token.service';

interface UserRecord {
  id: string;
  openid: string;
  role: UserRole;
  shopId?: string;
  nickName: string;
  avatarUrl: string;
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
  { openid: string; role: UserRole; nickName: string; shopId?: string }
> = {
  admin_code: {
    openid: 'mock_admin_openid_001',
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
    shopId: DEFAULT_SHOP_ID,
  },
};

const isProduction = process.env.NODE_ENV === 'production';
const MAX_SESSIONS_PER_USER = 5;

const initMemoryUsers = () => {
  if (memoryUsers.size > 0) return;

  const adminId = uuidv4();
  const adminOpenid = 'mock_admin_openid_001';
  const admin: UserRecord = {
    id: adminId,
    openid: adminOpenid,
    role: UserRole.ADMIN,
    shopId: DEFAULT_SHOP_ID,
    nickName: '商家管理员',
    avatarUrl: '',
    createdAt: '2025-06-01T00:00:00Z',
  };
  memoryUsers.set(adminId, admin);
  openidToUser.set(adminOpenid, admin);

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
    shopId: DEFAULT_SHOP_ID,
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
   * admin/rider 若未绑定店铺，补 DEFAULT_SHOP_ID。
   * customer 保持无 shopId。
   */
  private normalizeShopId(role: UserRole, shopId?: string | null): string | undefined {
    if (role === UserRole.ADMIN || role === UserRole.RIDER) {
      return shopId || DEFAULT_SHOP_ID;
    }
    return shopId || undefined;
  }

  private toPayload(user: UserRecord): CurrentUserPayload {
    return {
      userId: user.id,
      openid: user.openid,
      role: user.role,
      shopId: this.normalizeShopId(user.role, user.shopId),
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
      shopId: this.normalizeShopId(role, data.shop_id),
      nickName: data.nick_name || '',
      avatarUrl: data.avatar_url || '',
      createdAt: data.created_at || new Date().toISOString(),
    };
  }

  /** admin/rider 无 shopId 时补 DEFAULT_SHOP_ID（内存 + 尽量回写 DB） */
  private async ensureAdminShopBinding(user: UserRecord): Promise<UserRecord> {
    const shopId = this.normalizeShopId(user.role, user.shopId);
    const next: UserRecord = { ...user, shopId };
    memoryUsers.set(next.id, next);
    openidToUser.set(next.openid, next);

    const needWrite =
      !!shopId &&
      !user.shopId &&
      (user.role === UserRole.ADMIN || user.role === UserRole.RIDER) &&
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
    return {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      userId: bound.id,
      openid: bound.openid,
      role: bound.role,
      shopId: payload.shopId,
      nickName: bound.nickName,
    };
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
    let shopId: string | undefined;

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
    shopId?: string,
  ): Promise<LoginResponseDto> {
    assertMemoryFallbackAllowed('AuthService');
    let user = openidToUser.get(openid);
    if (!user) {
      const id = uuidv4();
      user = {
        id,
        openid,
        role,
        shopId,
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
            shopId: this.normalizeShopId(mem.role, mem.shopId),
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
      shopId: this.normalizeShopId(user.role, user.shopId),
    };
  }
}
