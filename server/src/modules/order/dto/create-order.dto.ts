import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
MinLength,
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

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  @MinLength(1)
  @IsOptional()
  contactNameValid?: string;

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
  contactPhone?: string;

  @IsNumber()
  @IsOptional()
  deliveryFee?: number;
}
