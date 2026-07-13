import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryType } from '../../../common/constants/enums';

export class CreateOrderItemDto {
  @IsString()
  @MinLength(1)
  menuItemId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

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

  @IsString()
  @IsOptional()
  tableNo?: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  contactPhone?: string;

  // deliveryFee 由服务端从店铺配置获取，不接受客户端传值
}
