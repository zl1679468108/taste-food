/**
 * 批量异步导出（T267）枚举与常量。
 *
 * 与 shared/src/constants/index.ts 双写保持一致：server 端 tsconfig
 * 未配置对 shared 的 paths 映射，故在此独立声明，避免跨模块依赖。
 */

/** 导出任务状态机：pending → processing → completed / failed */
export enum ExportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/** 可导出的业务实体 */
export enum ExportEntity {
  ORDERS = 'orders',
}

/** 当前仅支持 Excel（xlsx），不走 CSV */
export const EXPORT_FORMAT_XLSX = 'xlsx';

export const EXPORT_JOB_STATUSES: ExportJobStatus[] = [
  ExportJobStatus.PENDING,
  ExportJobStatus.PROCESSING,
  ExportJobStatus.COMPLETED,
  ExportJobStatus.FAILED,
];

export const EXPORT_ENTITIES: ExportEntity[] = [ExportEntity.ORDERS];

/** 导出任务状态中文文案（与 shared 对齐） */
export const EXPORT_JOB_STATUS_LABEL: Record<string, string> = {
  [ExportJobStatus.PENDING]: '排队中',
  [ExportJobStatus.PROCESSING]: '导出中',
  [ExportJobStatus.COMPLETED]: '已完成',
  [ExportJobStatus.FAILED]: '失败',
};

/** 导出文件存储桶（私有，禁止公开直链） */
export const EXPORT_STORAGE_BUCKET = 'export-files';

/** 单次导出最大行数（与服务端分页上限一致，防止超大导出拖垮进程） */
export const EXPORT_MAX_ROWS = 5000;
