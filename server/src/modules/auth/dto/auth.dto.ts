import { IsString, IsOptional } from 'class-validator';

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
  shopId?: string; // admin 必填，绑定管理的店铺
  nickName?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
