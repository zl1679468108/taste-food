import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { hasSupabase, supabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import { PaginatedData } from '../../common/interfaces/pagination.interface';

export interface AuditLogRecord {
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

interface AuditRow {
  id: string;
  shop_id?: string | null;
  user_id: string;
  role: string;
  method: string;
  path: string;
  action: string;
  resource?: string | null;
  resource_id?: string | null;
  summary: string;
  status_code?: number | null;
  ip?: string | null;
  created_at: string;
}

const memoryLogs: AuditLogRecord[] = [];
const MAX_MEMORY = 2000;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  private toRecord(row: AuditRow): AuditLogRecord {
    return {
      id: row.id,
      shopId: row.shop_id || undefined,
      userId: row.user_id,
      role: row.role,
      method: row.method,
      path: row.path,
      action: row.action,
      resource: row.resource || undefined,
      resourceId: row.resource_id || undefined,
      summary: row.summary,
      statusCode: row.status_code ?? undefined,
      ip: row.ip || undefined,
      createdAt: row.created_at,
    };
  }

  async record(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<void> {
    const record: AuditLogRecord = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...input,
      summary: (input.summary || '').slice(0, 500),
      path: (input.path || '').slice(0, 300),
      action: (input.action || '').slice(0, 120),
    };

    if (hasSupabase() && supabase) {
      try {
        const { error } = await supabase.from('tf_audit_logs').insert({
          id: record.id,
          shop_id: record.shopId || null,
          user_id: record.userId,
          role: record.role,
          method: record.method,
          path: record.path,
          action: record.action,
          resource: record.resource || null,
          resource_id: record.resourceId || null,
          summary: record.summary,
          status_code: record.statusCode ?? null,
          ip: record.ip || null,
          created_at: record.createdAt,
        });
        if (!error) return;
        this.logger.warn(`[Audit] 写入失败，回退内存: ${error.message}`);
      } catch (e) {
        this.logger.warn(`[Audit] 写入异常，回退内存: ${(e as Error).message}`);
      }
    }

    try {
      assertMemoryFallbackAllowed('audit logs');
    } catch {
      // 生产禁内存时静默跳过，不影响主业务
      return;
    }
    memoryLogs.unshift(record);
    if (memoryLogs.length > MAX_MEMORY) memoryLogs.length = MAX_MEMORY;
  }

  async list(params: {
    shopId?: string;
    page?: number;
    pageSize?: number;
    method?: string;
    action?: string;
    keyword?: string;
  }): Promise<PaginatedData<AuditLogRecord>> {
    const page = Math.max(params.page || 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize || 20, 1), 100);

    if (hasSupabase() && supabase) {
      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        let query = supabase
          .from('tf_audit_logs')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (params.shopId) query = query.eq('shop_id', params.shopId);
        if (params.method) query = query.eq('method', params.method.toUpperCase());
        if (params.action) query = query.ilike('action', `%${params.action}%`);
        if (params.keyword) {
          const q = params.keyword.trim();
          // 关键词模糊匹配：摘要 / 动作 / 路径 / 资源 / 操作人 / IP
          query = query.or(
            `summary.ilike.%${q}%,action.ilike.%${q}%,path.ilike.%${q}%,resource.ilike.%${q}%,user_id.ilike.%${q}%,ip.ilike.%${q}%`,
          );
        }
        const { data, error, count } = await query;
        if (error) throw error;
        return {
          items: (data || []).map((r) => this.toRecord(r as AuditRow)),
          total: count || 0,
          page,
          pageSize,
        };
      } catch (e) {
        this.logger.warn(`[Audit] 列表失败，回退内存: ${(e as Error).message}`);
      }
    }

    assertMemoryFallbackAllowed('audit list');
    let filtered = [...memoryLogs];
    if (params.shopId) filtered = filtered.filter((l) => l.shopId === params.shopId);
    if (params.method) {
      const m = params.method.toUpperCase();
      filtered = filtered.filter((l) => l.method === m);
    }
    if (params.action) {
      const a = params.action.toLowerCase();
      filtered = filtered.filter((l) => l.action.toLowerCase().includes(a));
    }
    if (params.keyword) {
      const q = params.keyword.trim().toLowerCase();
      filtered = filtered.filter((l) =>
        (l.summary || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q) ||
        (l.path || '').toLowerCase().includes(q) ||
        (l.resource || '').toLowerCase().includes(q) ||
        (l.userId || '').toLowerCase().includes(q) ||
        (l.ip || '').toLowerCase().includes(q),
      );
    }
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    };
  }
}
