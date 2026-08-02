import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import {
  ExportJobStatus,
  ExportEntity,
  EXPORT_FORMAT_XLSX,
} from '../../common/constants/export';

export interface ExportJobParams {
  status?: string;
  maxRows?: number;
}

export interface ExportJobRow {
  id: string;
  shopId: string;
  userId: string;
  entity: string;
  status: string;
  format: string;
  params: ExportJobParams;
  filePath?: string | null;
  fileName?: string | null;
  rowCount?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface ExportJobListResult {
  items: ExportJobRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** 无 Supabase 时内存回退（开发环境；生产环境禁用后不会走到这里） */
const memoryJobs: Map<string, ExportJobRow> = new Map();

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  async createJob(input: {
    shopId: string;
    userId: string;
    entity: string;
    status?: string;
    format?: string;
    params?: ExportJobParams;
  }): Promise<ExportJobRow> {
    const now = new Date().toISOString();
    const row: ExportJobRow = {
      id: uuidv4(),
      shopId: input.shopId,
      userId: input.userId,
      entity: input.entity,
      status: input.status || ExportJobStatus.PENDING,
      format: input.format || EXPORT_FORMAT_XLSX,
      params: input.params || {},
      filePath: null,
      fileName: null,
      rowCount: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_export_jobs')
        .insert({
          id: row.id,
          shop_id: row.shopId,
          user_id: row.userId,
          entity: row.entity,
          status: row.status,
          format: row.format,
          params: row.params,
        })
        .select('*')
        .single();
      if (error) {
        this.logger.error('[Export] 插入任务失败:', error);
        throw new Error(`创建导出任务失败: ${error.message}`);
      }
      return this.mapRow(data);
    }

    assertMemoryFallbackAllowed('ExportService.createJob');
    memoryJobs.set(row.id, row);
    return row;
  }

  async listJobs(opts: {
    shopId: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ExportJobListResult> {
    const page = Math.max(1, opts.page || 1);
    const pageSize = Math.min(Math.max(opts.pageSize || 20, 1), 100);

    if (hasSupabase() && supabase) {
      let query = supabase
        .from('tf_export_jobs')
        .select('*', { count: 'exact' })
        .eq('shop_id', opts.shopId)
        .order('created_at', { ascending: false });
      if (opts.status) query = query.eq('status', opts.status);
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
      const { data, error, count } = await query;
      if (error) {
        this.logger.error('[Export] 列表查询失败:', error);
        throw new Error(`查询导出任务失败: ${error.message}`);
      }
      return {
        items: (data || []).map((r) => this.mapRow(r)),
        total: count || 0,
        page,
        pageSize,
      };
    }

    assertMemoryFallbackAllowed('ExportService.listJobs');
    let all = Array.from(memoryJobs.values()).filter((j) => j.shopId === opts.shopId);
    if (opts.status) all = all.filter((j) => j.status === opts.status);
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const total = all.length;
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total, page, pageSize };
  }

  async getJob(id: string): Promise<ExportJobRow | null> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_export_jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        this.logger.warn('[Export] 查询任务失败:', error);
        return null;
      }
      return data ? this.mapRow(data) : null;
    }
    return memoryJobs.get(id) || null;
  }

  async updateJob(id: string, patch: Partial<ExportJobRow>): Promise<void> {
    const updatedAt = new Date().toISOString();
    if (hasSupabase() && supabase) {
      const set: Record<string, unknown> = { updated_at: updatedAt };
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.filePath !== undefined) set.file_path = patch.filePath;
      if (patch.fileName !== undefined) set.file_name = patch.fileName;
      if (patch.rowCount !== undefined) set.row_count = patch.rowCount;
      if (patch.errorMessage !== undefined) set.error_message = patch.errorMessage;
      if (patch.completedAt !== undefined) set.completed_at = patch.completedAt;
      if (patch.params !== undefined) set.params = patch.params;
      const { error } = await supabase.from('tf_export_jobs').update(set).eq('id', id);
      if (error) this.logger.warn('[Export] 更新任务失败:', error);
      return;
    }
    const existing = memoryJobs.get(id);
    if (!existing) return;
    memoryJobs.set(id, { ...existing, ...patch, updatedAt });
  }

  private mapRow(row: any): ExportJobRow {
    return {
      id: row.id,
      shopId: row.shop_id,
      userId: row.user_id,
      entity: row.entity,
      status: row.status,
      format: row.format,
      params:
        typeof row.params === 'string'
          ? JSON.parse(row.params || '{}')
          : row.params || {},
      filePath: row.file_path ?? null,
      fileName: row.file_name ?? null,
      rowCount: row.row_count ?? null,
      errorMessage: row.error_message ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at ?? null,
    };
  }
}
