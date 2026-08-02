import request from '@/utils/request';

export interface AuditLog {
  id: string;
  shopId?: string;
  userId: string;
  role: string;
  method: string;
  path: string;
  action: string;
  resource?: string;
  resourceId?: string;
  summary: string;
  statusCode?: number;
  ip?: string;
  createdAt: string;
}

export const getAuditLogs = (params: {
  page?: number;
  pageSize?: number;
  method?: string;
  action?: string;
  keyword?: string;
}) =>
  request.get('/api/platform/audit-logs', { params }) as Promise<{
    items: AuditLog[];
    total: number;
    page: number;
    pageSize: number;
  }>;
