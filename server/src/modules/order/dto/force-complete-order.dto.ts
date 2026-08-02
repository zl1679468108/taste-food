import { IsString, MaxLength, MinLength } from 'class-validator';

/** 商家/管理员强制完成外卖配送单（跳过围栏与拍照） */
export class ForceCompleteOrderDto {
  @IsString()
  @MinLength(2, { message: '强制完成原因至少 2 个字' })
  @MaxLength(200, { message: '强制完成原因不能超过 200 字' })
  reason!: string;
}
