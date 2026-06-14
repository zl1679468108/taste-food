import { IsString, IsOptional, IsNumber } from 'class-validator';
import { MenuItemStatus } from '../../../common/constants/enums';

export class CreateMenuItemDto {
  @IsString()
  name!: string;

  @IsString()
  shopId!: string;

  @IsString()
  categoryId!: string;

  @IsNumber()
  price!: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status?: MenuItemStatus;

  @IsNumber()
  @IsOptional()
  salesCount?: number;

  @IsString({ each: true })
  @IsOptional()
  specGroupIds?: string[];
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
}
