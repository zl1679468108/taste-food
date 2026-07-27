import { IsString, IsOptional, MinLength, IsIn, IsNotEmpty } from 'class-validator';

export class WechatLoginDto {
  @IsString()
  code!: string;

  @IsString()
  @IsOptional()
  nickName?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsOptional()
  nickName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  /** 注册意向：customer 直接生效；merchant/rider 先顾客再提交申请 */
  @IsOptional()
  @IsIn(['customer', 'merchant', 'rider'])
  intentRole?: 'customer' | 'merchant' | 'rider';
}

export class PasswordLoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class SwitchRoleDto {
  @IsIn(['customer', 'admin', 'rider', 'merchant'])
  role!: 'customer' | 'admin' | 'rider' | 'merchant';

  @IsOptional()
  @IsString()
  shopId?: string;
}

export class AuthResponseDto {
  token!: string;
  refreshToken!: string;
  user!: {
    id: string;
    openid: string;
    role: string;
    nickName?: string;
    avatarUrl?: string;
  };
}

export class LoginResponseDto {
  token!: string;
  refreshToken!: string;
  userId!: string;
  openid!: string;
  role!: string;
  shopId?: string;
  nickName?: string;
  username?: string;
  phone?: string;
  roles?: Array<{ role: string; shopId?: string | null; status: string }>;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
