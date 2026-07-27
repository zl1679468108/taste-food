import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRoleApplicationDto {
  @IsIn(['merchant', 'rider'])
  applyRole!: 'merchant' | 'rider';

  @IsOptional()
  @IsString()
  shopName?: string;

  @IsOptional()
  @IsString()
  shopAddress?: string;

  @IsOptional()
  @IsString()
  shopPhone?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class ReviewRoleApplicationDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MinLength(1)
  rejectReason?: string;
}
