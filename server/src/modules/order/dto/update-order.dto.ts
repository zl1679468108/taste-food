import { IsString, IsOptional, IsEnum } from 'class-validator';
import { OrderStatus } from '../../../common/constants/enums';

export class UpdateOrderDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class OrderQueryDto {
  @IsString()
  @IsOptional()
  user_id?: string;

  @IsString()
  @IsOptional()
  shop_id?: string;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

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
}
