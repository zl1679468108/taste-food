import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
  ValidateIf,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryType } from '../../../common/constants/enums';

export class CreateOrderItemDto {
  @IsString()
  @MinLength(1)
  menuItemId!: string;

  // 展示名可选：服务端以菜单库菜名为准，不信任客户端传值
  @IsString()
  @IsOptional()
  @MinLength(1)
  name?: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  // price 由服务端从数据库查询真实售价，客户端传入仅作展示参考
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsString()
  @IsOptional()
  specDesc?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  // 选中的规格选项 ID 列表，服务端据此累加 priceAdjust 核价
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specOptionIds?: string[];
}

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  shopId!: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsEnum(DeliveryType)
  deliveryType!: DeliveryType;

  @IsString()
  @IsOptional()
  address?: string;

  /** 配送地址纬度（GCJ-02）；外卖必填，客户端地址簿地图选点传入 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLongitude?: number;

  @IsString()
  @IsOptional()
  tableNo?: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  // 空字符串 '' 不触发 Matches；仅在有非空内容时校验手机号格式
  @ValidateIf((_o, v) => v !== undefined && v !== null && String(v).trim() !== '')
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  contactPhone?: string;

  // deliveryFee 由服务端从店铺配置获取，不接受客户端传值

  @IsBoolean()
  @IsOptional()
  invoiceNeeded?: boolean;

  @ValidateIf((o) => o.invoiceNeeded === true)
  @IsString()
  @MinLength(1, { message: '开票时必须填写发票抬头' })
  @MaxLength(100)
  invoiceTitle?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  invoiceTaxNo?: string;
}
