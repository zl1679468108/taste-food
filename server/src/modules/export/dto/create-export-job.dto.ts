import { IsIn, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { ExportEntity } from '../../../common/constants/export';

/**
 * 提交导出任务 DTO（T267）。
 * 仅支持 entity=orders，仅产出 Excel（xlsx），不走 CSV。
 */
export class CreateExportJobDto {
  @IsIn([ExportEntity.ORDERS])
  entity: string = ExportEntity.ORDERS;

  /** 订单状态过滤（透传给订单导出） */
  @IsOptional()
  @IsString()
  status?: string;

  /** 最大导出行数（1~5000，默认 1000） */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  maxRows?: number;

  /** 平台管理员可指定店铺；商家锁定本店（由 resolveAdminTargetShopId 强制） */
  @IsOptional()
  @IsString()
  shop_id?: string;
}
