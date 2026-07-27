import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MaxLength(32)
  nickName!: string;

  /** customer | admin(商家/平台) | rider */
  @IsIn(['customer', 'admin', 'merchant', 'rider'])
  role!: 'customer' | 'admin' | 'merchant' | 'rider';

  /** 商家账号必填：绑定店铺；平台管理员留空 */
  @IsOptional()
  @IsUUID()
  shopId?: string;

  /** 可选自定义 openid；不传则自动生成 mock openid（开发登录用） */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  openid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  nickName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;

  /** 仅平台管理员可改角色 */
  @IsOptional()
  @IsIn(['customer', 'admin', 'merchant', 'rider'])
  role?: 'customer' | 'admin' | 'merchant' | 'rider';

  /** 仅平台管理员可改绑定店铺；空字符串表示解绑（平台管理员） */
  @IsOptional()
  @IsString()
  shopId?: string | null;
}
