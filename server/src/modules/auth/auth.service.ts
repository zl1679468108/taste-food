import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { WechatLoginDto, LoginResponseDto, RefreshTokenDto } from './dto/auth.dto';
import { supabase, hasSupabase } from '../../database/supabase.client';

interface UserRecord {
  id: string;
  openid: string;
  role: UserRole;
  nickName: string;
  avatarUrl: string;
  createdAt: string;
}

// Token 配置
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 分钟
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 天

const memoryUsers: Map<string, UserRecord> = new Map();
const openidToUser: Map<string, UserRecord> = new Map();
const refreshTokenStore: Map<string, string> = new Map(); // refresh_token -> userId

const initMemoryUsers = () => {
  if (memoryUsers.size > 0) return;

  const adminId = uuidv4();
  const adminOpenid = 'mock_admin_openid_001';
  const admin: UserRecord = {
    id: adminId, openid: adminOpenid, role: UserRole.ADMIN,
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
  constructor(private readonly jwtService: JwtService) {
    initMemoryUsers();
  }

  private toPayload(user: UserRecord): CurrentUserPayload {
    return {
      userId: user.id,
      openid: user.openid,
      role: user.role,
    };
  }

  async wechatLogin(dto: WechatLoginDto): Promise<LoginResponseDto> {
    let openid: string;
    let nickName: string;

    let role: UserRole = UserRole.CUSTOMER;
    
    if (dto.code === 'admin_code') {
      openid = 'mock_admin_openid_001';
      nickName = dto.nickName || '商家管理员';
      role = UserRole.ADMIN;
    } else if (dto.code === 'customer_code') {
      openid = 'mock_customer_openid_001';
      nickName = dto.nickName || '测试顾客';
      role = UserRole.CUSTOMER;
    } else if (dto.code === 'rider_code') {
      openid = 'mock_rider_openid_001';
      nickName = dto.nickName || '测试骑手';
      role = UserRole.RIDER;
    } else {
      openid = `mock_openid_${dto.code || uuidv4().substring(0, 8)}`;
      nickName = dto.nickName || `顾客${openid.substring(openid.length - 4)}`;
      role = UserRole.CUSTOMER;
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
          nickName: data.nick_name, avatarUrl: data.avatar_url,
          createdAt: data.created_at,
        };
      } else {
        // 如果用户已存在，更新角色
        if (user.role !== role) {
          await supabase
            .from('tf_users')
            .update({ role })
            .eq('id', user.id);
          user.role = role;
        }
      }
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
    } else {
      // 如果用户已存在，更新角色
      user.role = role;
    }

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
    refreshTokenStore.set(refreshToken, userId);
    return refreshToken;
  }

  async refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      
      // 验证 refresh_token 是否在存储中
      const userId = refreshTokenStore.get(refreshToken);
      if (!userId || userId !== payload.userId) {
        throw new UnauthorizedException('无效的 refresh token');
      }
      
      // 获取用户信息
      const user = await this.getUserById(userId);
      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }
      
      // 删除旧的 refresh_token
      refreshTokenStore.delete(refreshToken);
      
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
        nickName: data.nick_name, avatarUrl: data.avatar_url,
        createdAt: data.created_at,
      };
    }
    return memoryUsers.get(userId) || null;
  }
}
