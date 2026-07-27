import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';

export interface InboxNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedType?: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

const memory = new Map<string, InboxNotification>();

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  async create(input: {
    userId: string;
    type: string;
    title: string;
    content: string;
    relatedType?: string;
    relatedId?: string;
  }): Promise<InboxNotification> {
    const record: InboxNotification = {
      id: uuidv4(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      content: input.content,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_notifications')
        .insert({
          id: record.id,
          user_id: record.userId,
          type: record.type,
          title: record.title,
          content: record.content,
          related_type: record.relatedType || null,
          related_id: record.relatedId || null,
          is_read: false,
        })
        .select('*')
        .single();
      if (!error && data) {
        return this.toRecord(data);
      }
      this.logger.warn(`[Inbox] insert failed: ${error?.message}`);
    }

    assertMemoryFallbackAllowed('InboxService');
    memory.set(record.id, record);
    return record;
  }

  async listForUser(userId: string, page = 1, pageSize = 20) {
    if (hasSupabase() && supabase) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from('tf_notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (!error) {
        return {
          items: (data || []).map((r) => this.toRecord(r)),
          total: count || 0,
          page,
          pageSize,
        };
      }
      this.logger.warn(`[Inbox] list failed: ${error.message}`);
    }
    assertMemoryFallbackAllowed('InboxService');
    const all = Array.from(memory.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = (page - 1) * pageSize;
    return {
      items: all.slice(start, start + pageSize),
      total: all.length,
      page,
      pageSize,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    if (hasSupabase() && supabase) {
      const { count, error } = await supabase
        .from('tf_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (!error) return count || 0;
    }
    assertMemoryFallbackAllowed('InboxService');
    return Array.from(memory.values()).filter((n) => n.userId === userId && !n.isRead).length;
  }

  async markRead(userId: string, id: string): Promise<InboxNotification> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (!error && data) return this.toRecord(data);
      if (error) this.logger.warn(`[Inbox] markRead failed: ${error.message}`);
    }
    assertMemoryFallbackAllowed('InboxService');
    const row = memory.get(id);
    if (!row || row.userId !== userId) throw new NotFoundException('消息不存在');
    row.isRead = true;
    memory.set(id, row);
    return row;
  }

  async markAllRead(userId: string): Promise<number> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select('id');
      if (!error) return data?.length || 0;
    }
    assertMemoryFallbackAllowed('InboxService');
    let n = 0;
    for (const row of memory.values()) {
      if (row.userId === userId && !row.isRead) {
        row.isRead = true;
        n += 1;
      }
    }
    return n;
  }

  private toRecord(row: any): InboxNotification {
    return {
      id: row.id,
      userId: row.user_id || row.userId,
      type: row.type,
      title: row.title,
      content: row.content || '',
      relatedType: row.related_type || row.relatedType,
      relatedId: row.related_id || row.relatedId,
      isRead: !!(row.is_read ?? row.isRead),
      createdAt: row.created_at || row.createdAt,
    };
  }
}
