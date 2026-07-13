import { IsString, IsOptional, IsNumber, Min, IsInt, IsEnum } from 'class-validator';
import { MenuItemStatus } from '../../../common/constants/enums';

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
  createdAt!: string;
  updatedAt!: string;

  isFavorite?: boolean;
}
