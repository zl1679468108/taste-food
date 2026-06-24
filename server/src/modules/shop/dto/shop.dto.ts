import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ShopStatus } from '../../../common/constants/enums';

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
  createdAt!: string;
  updatedAt!: string;
}
