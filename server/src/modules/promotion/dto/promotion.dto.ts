import { IsString, IsOptional, IsEnum, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PromotionType, PromotionStatus } from '../../../common/constants/enums';

export class CreatePromotionDto {
  @IsString()
  shopId!: string;

  @IsEnum(PromotionType)
  type!: PromotionType;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  rule!: Record<string, any>;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;
}

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  rule?: Record<string, any>;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;
}

export class PromotionResponseDto {
  id!: string;
  shopId!: string;
  type!: PromotionType;
  name!: string;
  description?: string;
  rule!: Record<string, any>;
  startDate?: string;
  endDate?: string;
  status!: PromotionStatus;
  createdAt!: string;
  updatedAt!: string;
}
