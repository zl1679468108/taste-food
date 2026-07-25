import { IsString, IsOptional, IsEnum, IsNumber, IsObject } from 'class-validator';
import { ShopStatus } from '../../../common/constants/enums';
import { BusinessHours } from '../business-hours.util';

export class CreateShopDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsEnum(ShopStatus)
  @IsOptional()
  status?: ShopStatus;

  @IsNumber()
  @IsOptional()
  deliveryRange?: number;

  @IsNumber()
  @IsOptional()
  deliveryFee?: number;

  @IsNumber()
  @IsOptional()
  minOrderAmount?: number;

  @IsObject()
  @IsOptional()
  businessHours?: BusinessHours;
}

export class UpdateShopDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsNumber()
  @IsOptional()
  deliveryRange?: number;

  @IsNumber()
  @IsOptional()
  deliveryFee?: number;

  @IsNumber()
  @IsOptional()
  minOrderAmount?: number;

  @IsObject()
  @IsOptional()
  businessHours?: BusinessHours;
}

export class ShopResponseDto {
  id!: string;
  name!: string;
  description?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  status!: ShopStatus;
  deliveryRange!: number;
  deliveryFee!: number;
  minOrderAmount!: number;
  businessHours?: BusinessHours;
  /** 当前是否可下单（综合开关店 + 营业时段） */
  isOpenNow?: boolean;
  /** 非营业时的下次营业提示 */
  nextOpenHint?: string | null;
  createdAt!: string;
  updatedAt!: string;
}

export class UpdateBusinessHoursDto {
  @IsObject()
  businessHours!: BusinessHours;
}

export class BusinessHoursResponseDto {
  shopId!: string;
  status!: ShopStatus;
  businessHours!: BusinessHours;
  isOpenNow!: boolean;
  nextOpenHint!: string | null;
}
