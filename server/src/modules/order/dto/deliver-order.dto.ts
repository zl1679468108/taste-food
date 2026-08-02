import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * 骑手确认送达
 * - 必须在收货地址围栏内（默认 500m，含精度缓冲）
 * - 必须上传 1~3 张送达现场照片
 */
export class DeliverOrderDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  /** 定位精度（米），用于服务端半径缓冲 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  /** 已上传的送达照片 URL，1~3 张 */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  photoUrls!: string[];
}
