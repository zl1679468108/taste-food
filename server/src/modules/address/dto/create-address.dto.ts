import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @MinLength(1, { message: '联系人不能为空' })
  @MaxLength(32)
  contactName!: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  contactPhone!: string;

  @IsString()
  @MinLength(1, { message: '详细地址不能为空' })
  @MaxLength(200)
  detail!: string;

  @IsString()
  @IsOptional()
  @MaxLength(16)
  tag?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
