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

  /** 腾讯地图 GCJ-02 纬度（选点/定位优先；缺省可由服务端 geocode） */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  /** 腾讯地图 GCJ-02 经度 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  tag?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
