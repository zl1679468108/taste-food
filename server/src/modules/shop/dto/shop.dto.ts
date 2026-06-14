import { IsString, IsOptional, IsEnum } from 'class-validator';
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
}

export class ShopResponseDto {
  id!: string;
  name!: string;
  description?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  status!: ShopStatus;
  createdAt!: string;
  updatedAt!: string;
}
