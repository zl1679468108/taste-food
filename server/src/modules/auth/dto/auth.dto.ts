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
  userId!: string;
  openid!: string;
  role!: string;
}
