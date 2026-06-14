import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { WechatLoginDto, LoginResponseDto } from './dto/auth.dto';

interface UserRecord {
  id: string;
  openid: string;
  role: UserRole;
  nickName: string;
  avatarUrl: string;
  createdAt: string;
}

@Injectable()
export class AuthService {
  private users: Map<string, UserRecord> = new Map();
  private openidToUser: Map<string, UserRecord> = new Map();

  constructor(private readonly jwtService: JwtService) {
    // 创建默认管理员账户（用于开发测试）
    const adminId = uuidv4();
    const adminOpenid = 'mock_admin_openid_001';
    const admin: UserRecord = {
      id: adminId,
      openid: adminOpenid,
      role: UserRole.ADMIN,
      nickName: '商家管理员',
      avatarUrl: '',
      createdAt: '2025-06-01T00:00:00Z',
    };
    this.users.set(adminId, admin);
    this.openidToUser.set(adminOpenid, admin);

    // 创建默认顾客
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
    this.users.set(customerId, customer);
    this.openidToUser.set(customerOpenid, customer);
  }

  async wechatLogin(dto: WechatLoginDto): Promise<LoginResponseDto> {
    // 模拟微信登录
    // 在实际环境中，这里会调用微信接口用 code 换取 openid
    // 这里我们根据 code 模拟生成 openid
    let openid: string;
    let nickName: string;

    if (dto.code === 'admin_code') {
      // 管理员登录
      openid = 'mock_admin_openid_001';
      nickName = dto.nickName || '商家管理员';
    } else if (dto.code === 'customer_code') {
      // 指定顾客
      openid = 'mock_customer_openid_001';
      nickName = dto.nickName || '测试顾客';
    } else {
      // 模拟任意 code 生成 openid
      openid = `mock_openid_${dto.code || uuidv4().substring(0, 8)}`;
      nickName = dto.nickName || `顾客${openid.substring(openid.length - 4)}`;
    }

    // 查找或创建用户
    let user = this.openidToUser.get(openid);
    if (!user) {
      user = {
        id: uuidv4(),
        openid,
        role: UserRole.CUSTOMER,
        nickName,
        avatarUrl: dto.avatarUrl || '',
        createdAt: new Date().toISOString(),
      };
      this.users.set(user.id, user);
      this.openidToUser.set(openid, user);
    }

    // 生成 JWT token
    const payload: CurrentUserPayload = {
      userId: user.id,
      openid: user.openid,
      role: user.role,
    };

    const token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'default-secret',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    return {
      token,
      userId: user.id,
      openid: user.openid,
      role: user.role,
    };
  }

  async validateToken(token: string): Promise<CurrentUserPayload> {
    try {
      return this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'default-secret',
      });
    } catch {
      throw new UnauthorizedException('无效的 token');
    }
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) || null;
  }
}
