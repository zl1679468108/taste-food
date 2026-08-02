import { IsString, IsOptional, IsEnum, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../../../common/constants/enums';

export class UpdateOrderDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  /** 接单时预计出餐分钟数（5~120） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  estimatedMinutes?: number;
}

export class CancelRequestDto {
  @IsString()
  reason!: string;
}

export class ResolveCancelRequestDto {
  @IsBoolean()
  approve!: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class OrderQueryDto {
  @IsString()
  @IsOptional()
  user_id?: string;

  @IsString()
  @IsOptional()
  shop_id?: string;

  /** 单状态 / 逗号多状态 / active|history|review|refund|cancel_request 分组 */
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  rider_id?: string;

  @IsString()
  @IsOptional()
  is_pool?: string;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  pageSize?: string;

  /** 搜索关键词（模糊匹配订单号/联系人/电话） */
  @IsString()
  @IsOptional()
  keyword?: string;
}
