import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateSpecGroupDto {
  @IsString()
  shopId!: string;

  @IsString()
  name!: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsNumber()
  @IsOptional()
  maxSelect?: number;
}

export class CreateSpecOptionDto {
  @IsString()
  specGroupId!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @IsOptional()
  priceAdjust?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class SpecGroupResponseDto {
  id!: string;
  shopId!: string;
  name!: string;
  isRequired!: boolean;
  maxSelect!: number;
  options!: SpecOptionResponseDto[];
  createdAt!: string;
  updatedAt!: string;
}

export class SpecOptionResponseDto {
  id!: string;
  specGroupId!: string;
  name!: string;
  priceAdjust!: number;
  isDefault!: boolean;
  createdAt!: string;
  updatedAt!: string;
}
