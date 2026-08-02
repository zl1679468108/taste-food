import { IsString, IsOptional, IsEnum, IsNumber, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
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

  /** 腾讯地图 GCJ-02 纬度 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  /** 腾讯地图 GCJ-02 经度 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

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

  /** 骑手确认送达围栏（米），默认 500，范围 200~1000 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(200)
  @Max(1000)
  deliveryConfirmRadiusM?: number;

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

  /** 腾讯地图 GCJ-02 纬度 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  /** 腾讯地图 GCJ-02 经度 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsNumber()
  @IsOptional()
  deliveryRange?: number;

  /** 骑手确认送达围栏（米），默认 500，范围 200~1000 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(200)
  @Max(1000)
  deliveryConfirmRadiusM?: number;

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
  latitude?: number;
  longitude?: number;
  phone?: string;
  logoUrl?: string;
  status!: ShopStatus;
  deliveryRange!: number;
  deliveryConfirmRadiusM?: number;
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
