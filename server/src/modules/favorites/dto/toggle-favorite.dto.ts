import { IsNotEmpty, IsString } from 'class-validator';

export class ToggleFavoriteDto {
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @IsString()
  @IsNotEmpty()
  shopId!: string;
}
