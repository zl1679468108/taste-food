import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 规格组内嵌选项：随规格组一次性提交，服务端按「全量替换」语义落库 */
export class SpecGroupOptionInputDto {
  /** 已有选项传 id 用于保留；新增选项不传 */
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  name!: string;

  /** 价格修正（单位：分），可为负数表示减价 */
  @IsNumber()
  @IsOptional()
  priceAdjust?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

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
  @Min(1)
  maxSelect?: number;

  /**
   * 规格选项列表。传入时按全量替换处理（未出现的旧选项将被删除）；
   * 不传（undefined）表示不改动现有选项。
   */
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SpecGroupOptionInputDto)
  options?: SpecGroupOptionInputDto[];
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
