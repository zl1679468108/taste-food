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

/** GET /api/promotions/conflicts 的查询参数 */
export class QueryPromotionConflictDto {
  @IsOptional()
  @IsString()
  shopId?: string;

  @IsEnum(PromotionType)
  type!: PromotionType;

  /** 空表示「无开始时间」，按 -∞ 处理（即刻生效） */
  @IsOptional()
  @IsString()
  startTime?: string;

  /** 空表示「无结束时间」，按 +∞ 处理（长期有效） */
  @IsOptional()
  @IsString()
  endTime?: string;

  /** 编辑场景排除自身 */
  @IsOptional()
  @IsString()
  excludeId?: string;
}

export class PromotionConflictResultDto {
  /** 是否存在时间段重叠（前端据此决定是否弹提示） */
  hasConflict!: boolean;
  /** 冲突的促销列表，按开始时间升序 */
  conflicts!: PromotionResponseDto[];
}
