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

export class UpdateAddressDto {
  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(32)
  contactName?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(20)
  contactPhone?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  detail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

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
