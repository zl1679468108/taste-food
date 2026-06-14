import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsString()
  shopId!: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @IsOptional()
  icon?: string;
}

export class CategoryResponseDto {
  id!: string;
  shopId!: string;
  name!: string;
  sortOrder!: number;
  icon?: string;
  createdAt!: string;
  updatedAt!: string;
}
