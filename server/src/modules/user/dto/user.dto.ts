import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * UUID 形状校验（8-4-4-4-12 十六进制）。
 *
 * 不用 `@IsUUID()`：validator ≥13.15 收紧为严格 RFC 校验，要求版本位为 1-8、
 * 变体位为 8/9/a/b。而项目种子数据（如 `DEFAULT_SHOP_ID`
 * `00000000-0000-0000-0000-000000000001`）版本位与变体位均为 0，会被判为非法，
 * 导致「为默认店铺创建商家账号」这条主链路直接 400。
 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateUserDto {
  @IsString()
  @MaxLength(32)
  nickName!: string;

  /** customer 顾客 | merchant 商家 | admin 平台管理员 | rider 骑手 */
  @IsIn(['customer', 'admin', 'merchant', 'rider'])
  role!: 'customer' | 'admin' | 'merchant' | 'rider';

  /** merchant 必填（绑定店铺）；admin 必须留空（平台管理员不绑店） */
  @IsOptional()
  @Matches(UUID_SHAPE, { message: 'shopId 必须是合法的店铺 UUID' })
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

  /**
   * 仅平台管理员可改绑定店铺；空字符串 / null 表示解绑。
   * 注意：role 改为 admin 时必须同时传 null 解绑，否则请求会被拒绝（T301）。
   */
  @IsOptional()
  @IsString()
  shopId?: string | null;
}
