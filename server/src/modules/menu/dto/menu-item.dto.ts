import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsInt,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsBoolean,
} from 'class-validator';
import { MenuItemStatus } from '../../../common/constants/enums';
import { SpecGroupResponseDto } from './spec.dto';

/** 批量改状态单次允许操作的菜品数量上限 */
export const MAX_BATCH_STATUS_IDS = 200;

export class CreateMenuItemDto {
  @IsString()
  name!: string;

  @IsString()
  shopId!: string;

  @IsString()
  categoryId!: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(MenuItemStatus)
  @IsOptional()
  status?: MenuItemStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  salesCount?: number;

  @IsString({ each: true })
  @IsOptional()
  specGroupIds?: string[];

  @IsOptional()
  isFavorite?: boolean;
}

/** 批量上/下架请求体 */
export class BatchUpdateMenuItemStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BATCH_STATUS_IDS)
  @IsString({ each: true })
  ids!: string[];

  /** true=上架（active），false=下架（inactive） */
  @IsBoolean()
  isAvailable!: boolean;

  /** 平台管理员可指定目标店铺；商家忽略该字段并强制本店 */
  @IsString()
  @IsOptional()
  shopId?: string;
}

/** 批量上/下架结果 */
export class BatchUpdateMenuItemStatusResultDto {
  /** 实际更新成功的菜品数量 */
  updated!: number;
}

export class MenuItemResponseDto {
  id!: string;
  shopId!: string;
  categoryId!: string;
  name!: string;
  price!: number;
  imageUrl?: string;
  description?: string;
  status!: MenuItemStatus;
  salesCount!: number;
  specGroupIds?: string[];
  /** 规格明细（与菜品一次返回，避免二次 /specs） */
  specs?: SpecGroupResponseDto[];
  createdAt!: string;
  updatedAt!: string;

  isFavorite?: boolean;
}
