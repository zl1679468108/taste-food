import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateShopTableDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  tableNo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateShopTableDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  tableNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ShopTableDto {
  id!: string;
  shopId!: string;
  tableNo!: string;
  label?: string;
  sortOrder!: number;
  active!: boolean;
  /** 小程序扫码 path（pages/menu/index?...） */
  scanPath!: string;
  createdAt!: string;
}
