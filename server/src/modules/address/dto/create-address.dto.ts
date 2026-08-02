import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAddressDto {
  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  contactName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  contactPhone!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  detail!: string;

  /** 腾讯地图 GCJ-02 纬度（地图选点必填） */
  @Type(() => Number)
  @IsNumber({}, { message: '请通过地图选点获取地址坐标' })
  @Min(-90)
  @Max(90)
  latitude!: number;

  /** 腾讯地图 GCJ-02 经度（地图选点必填） */
  @Type(() => Number)
  @IsNumber({}, { message: '请通过地图选点获取地址坐标' })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  tag?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
