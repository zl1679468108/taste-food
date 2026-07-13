import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { WechatLoginDto, LoginResponseDto, RefreshTokenDto } from './dto/auth.dto';
import { supabase, hasSupabase } from '../../database/supabase.client';

interface UserRecord {
  id: string;
  openid: string;
  role: UserRole;
  shopId?: string; // 多租户：admin 必填，绑定管理的店铺
  nickName: string;
  avatarUrl: string;
  createdAt: string;
}

// Token 配置
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 分钟
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 天
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天（毫秒，用于数据库过期时间）

// 默认店铺 ID（与 menu.controller.ts 中 DEFAULT_SHOP_ID 一致，单店铺场景兜底）
const DEFAULT_SHOP_ID = '00000000-0000-0000-0000-000000000001';

const memoryUsers: Map<string, UserRecord> = new Map();
const openidToUser: Map<string, UserRecord> = new Map();
// 开发环境内存回退（仅当 Supabase 不可用时使用，生产环境必须依赖数据库持久化）
const refreshTokenStore: Map<string, string> = new Map(); // refresh_token -> userId

// 开发环境 mock 用户映射（仅用于本地测试，生产环境禁用）
const DEV_MOCK_USERS: Record<string, { openid: string; role: UserRole; nickName: string; shopId?: string }> = {
  admin_code: { openid: 'mock_admin_openid_001', role: UserRole.ADMIN, nickName: '商家管理员', shopId: DEFAULT_SHOP_ID },
  customer_code: { openid: 'mock_customer_openid_001', role: UserRole.CUSTOMER, nickName: '测试顾客' },
  rider_code: { openid: 'mock_rider_openid_001', role: UserRole.RIDER, nickName: '测试骑手' },
};

const isProduction = process.env.NODE_ENV === 'production';

const initMemoryUsers = () => {
  if (memoryUsers.size > 0) return;

  const adminId = uuidv4();
  const adminOpenid = 'mock_admin_openid_001';
  const admin: UserRecord = {
    id: adminId, openid: adminOpenid, role: UserRole.ADMIN,
    shopId: DEFAULT_SHOP_ID,
    nickName: '商家管理员', avatarUrl: '',
    createdAt: '2025-06-01T00:00:00Z',
  };
  memoryUsers.set(adminId, admin);
  openidToUser.set(adminOpenid, admin);

  const customerId = uuidv4();
  const customerOpenid = 'mock_customer_openid_001';
  const customer: UserRecord = {
    id: customerId, openid: customerOpenid, role: UserRole.CUSTOMER,
    nickName: '测试顾客', avatarUrl: '',
    createdAt: '2025-06-01T00:00:00Z',
  };
  memoryUsers.set(customerId, customer);
  openidToUser.set(customerOpenid, customer);

  const riderId = uuidv4();
  const riderOpenid = 'mock_rider_openid_001';
  const rider: UserRecord = {
    id: riderId, openid: riderOpenid, role: UserRole.RIDER,
    nickName: '测试骑手', avatarUrl: '',
    createdAt: '2025-06-01T00:00:00Z',
  };
  memoryUsers.set(riderId, rider);
  openidToUser.set(riderOpenid, rider);
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly jwtService: JwtService) {
    initMemoryUsers();
  }

  private toPayload(user: UserRecord): CurrentUserPayload {
    return {
      userId: user.id,
      openid: user.openid,
      role: user.role,
      shopId: user.shopId,
    };
  }

  /**
   * 调用微信 code2Session 接口校验 code 并获取真实 openid。
   * 生产环境必须调用此方法，不能信任客户端传入的 code。
   */
  private async code2Session(code: string): Promise<{ openid: string }> {
    const appid = process.env.WX_APPID;
    const secret = process.env.WX_SECRET;

    if (!appid || !secret) {
      throw new BadRequestException('微信小程序配置缺失（WX_APPID/WX_SECRET）');
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const resp = await fetch(url);
    const data = await resp.json() as { openid?: string; errcode?: number; errmsg?: string };

    if (data.errcode || !data.openid) {
      this.logger.error(`微信 code2Session 失败: errcode=${data.errcode} errmsg=${data.errmsg}`);
      throw new UnauthorizedException(`微信登录失败: ${data.errmsg || 'code 无效'}`);
    }

    return { openid: data.openid };
  }

  async wechatLogin(dto: WechatLoginDto): Promise<LoginResponseDto> {
    let openid: string;
    let nickName: string;
    let role: UserRole = UserRole.CUSTOMER;

    if (isProduction) {
      // 生产环境：调用真实微信 API 校验 code，角色由数据库记录决定
      const session = await this.code2Session(dto.code);
      openid = session.openid;
      nickName = dto.nickName || `顾客${openid.substring(openid.length - 4)}`;
      // 角色不从客户端决定，新用户默认 CUSTOMER，已存在用户保持原角色
    } else {
      // 开发环境：支持 mock code 快速测试
      const mockUser = DEV_MOCK_USERS[dto.code];
      if (mockUser) {
        openid = mockUser.openid;
        nickName = dto.nickName || mockUser.nickName;
        role = mockUser.role;
      } else {
        // 开发环境也支持真实 code（如配置了 WX_APPID/WX_SECRET）
        if (process.env.WX_APPID && process.env.WX_SECRET) {
          const session = await this.code2Session(dto.code);
          openid = session.openid;
        } else {
          openid = `mock_openid_${dto.code || uuidv4().substring(0, 8)}`;
        }
        nickName = dto.nickName || `顾客${openid.substring(openid.length - 4)}`;
      }
    }

    if (hasSupabase() && supabase) {
      let user = await this.findUserByOpenidDb(openid);
      if (!user) {
        // 新用户：使用确定的角色创建
        const { data, error } = await supabase
          .from('tf_users')
          .insert({
            id: uuidv4(),
            openid,
            role,
            nick_name: nickName,
            avatar_url: dto.avatarUrl || '',
          })
          .select()
          .single();
        if (error) {
          return this.wechatLoginMemory(openid, nickName, dto, role);
        }
        user = {
          id: data.id, openid: data.openid, role: data.role,
          shopId: data.shop_id || undefined,
          nickName: data.nick_name, avatarUrl: data.avatar_url,
          createdAt: data.created_at,
        };
      }
      // 注意：已存在用户不根据 code 覆盖角色，防止客户端提权
      // 角色变更只能通过管理员后台接口
      const payload = this.toPayload(user);
      const token = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
      const refreshToken = this.generateRefreshToken(user.id);
      return {
        token, refreshToken, userId: user.id, openid: user.openid, role: user.role,
      };
    }

    return this.wechatLoginMemory(openid, nickName, dto, role);
  }

  private async wechatLoginMemory(
    openid: string, nickName: string, dto: WechatLoginDto, role: UserRole = UserRole.CUSTOMER,
  ): Promise<LoginResponseDto> {
    let user = openidToUser.get(openid);
    if (!user) {
      const id = uuidv4();
      user = {
        id, openid, role,
        nickName, avatarUrl: dto.avatarUrl || '',
        createdAt: new Date().toISOString(),
      };
      memoryUsers.set(id, user);
      openidToUser.set(openid, user);
    }
    // 注意：已存在内存用户不覆盖角色，防止客户端提权

    const payload = this.toPayload(user);
    const token = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
    const refreshToken = this.generateRefreshToken(user.id);
    return {
      token, refreshToken, userId: user.id, openid: user.openid, role: user.role,
    };
  }

  private async findUserByOpenidDb(openid: string): Promise<UserRecord | null> {
    if (!hasSupabase() || !supabase) return null;
    const { data, error } = await supabase
      .from('tf_users')
      .select('*').eq('openid', openid).single();
    if (error || !data) return null;
    return {
      id: data.id, openid: data.openid, role: data.role,
      shopId: data.shop_id || undefined,
      nickName: data.nick_name, avatarUrl: data.avatar_url,
      createdAt: data.created_at,
    };
  }

  async validateToken(token: string): Promise<CurrentUserPayload> {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('无效的 token');
    }
  }

  private generateRefreshToken(userId: string): string {
    const refreshToken = this.jwtService.sign(
      { userId, type: 'refresh' },
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    if (hasSupabase() && supabase) {
      // 生产环境：持久化到数据库（存哈希不存明文）
      const tokenHash = this.hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
      supabase
        .from('tf_refresh_tokens')
        .insert({
          token_hash: tokenHash,
          user_id: userId,
          expires_at: expiresAt,
          revoked: false,
        })
        .then(({ error }) => {
          if (error) {
            this.logger.error(`持久化 refresh_token 失败: ${error.message}`);
          }
        });
    } else {
      // 开发环境内存回退
      refreshTokenStore.set(refreshToken, userId);
    }
    return refreshToken;
  }

  /**
   * 计算 token 的 SHA-256 哈希（数据库不存明文）
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken);

      // 验证 refresh_token 是否在存储中（数据库优先，内存回退）
      let storedUserId: string | null = null;
      let useMemory = false;

      if (hasSupabase() && supabase) {
        const tokenHash = this.hashToken(refreshToken);
        const { data, error } = await supabase
          .from('tf_refresh_tokens')
          .select('user_id, revoked, expires_at')
          .eq('token_hash', tokenHash)
          .single();

        if (error || !data) {
          throw new UnauthorizedException('无效的 refresh token');
        }
        if (data.revoked) {
          throw new UnauthorizedException('refresh token 已被吊销');
        }
        if (new Date(data.expires_at) < new Date()) {
          throw new UnauthorizedException('refresh token 已过期');
        }
        storedUserId = data.user_id;
      } else {
        storedUserId = refreshTokenStore.get(refreshToken) || null;
        useMemory = true;
      }

      if (!storedUserId || storedUserId !== payload.userId) {
        throw new UnauthorizedException('无效的 refresh token');
      }

      // 获取用户信息
      const user = await this.getUserById(storedUserId);
      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      // 删除/吊销旧的 refresh_token（Token 轮换）
      if (useMemory) {
        refreshTokenStore.delete(refreshToken);
      } else if (hasSupabase() && supabase) {
        const tokenHash = this.hashToken(refreshToken);
        await supabase
          .from('tf_refresh_tokens')
          .update({ revoked: true })
          .eq('token_hash', tokenHash);
      }

      // 生成新的 token
      const newPayload = this.toPayload(user);
      const newToken = this.jwtService.sign(newPayload, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
      const newRefreshToken = this.generateRefreshToken(user.id);

      return { token: newToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('无效的 refresh token');
    }
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_users').select('*').eq('id', userId).single();
      if (error || !data) return null;
      return {
        id: data.id, openid: data.openid, role: data.role,
        shopId: data.shop_id || undefined,
        nickName: data.nick_name, avatarUrl: data.avatar_url,
        createdAt: data.created_at,
      };
    }
    return memoryUsers.get(userId) || null;
  }
}
