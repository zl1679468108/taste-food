import request from '@/utils/request';

export type ExportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExportJob {
  id: string;
  shopId: string;
  userId: string;
  entity: string;
  status: ExportJobStatus;
  format: string;
  params: { status?: string; maxRows?: number };
  filePath?: string | null;
  fileName?: string | null;
  rowCount?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface ExportJobListResult {
  items: ExportJob[];
  total: number;
  page: number;
  pageSize: number;
}

/** 列表（按店铺隔离，由服务端强制） */
export const listExportJobs = (params: {
  shop_id?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) => request.get('/api/merchant/export-jobs', { params }) as Promise<ExportJobListResult>;

/** 提交导出任务（后台异步执行，立即返回任务对象） */
export const createExportJob = (body: {
  entity?: string;
  status?: string;
  maxRows?: number;
  shop_id?: string;
}) => request.post('/api/merchant/export-jobs', body) as Promise<ExportJob>;

/** 下载产物（已完成时返回 xlsx Blob；文件名由调用方从任务 fileName 传入） */
export const downloadExportJob = (id: string, shopId?: string) =>
  request.get(`/api/merchant/export-jobs/${id}/download`, {
    params: shopId ? { shop_id: shopId } : undefined,
    responseType: 'blob',
    skipErrorMessage: true,
  }) as Promise<Blob>;
