import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { supabase, hasSupabase } from '../../database/supabase.client';

/**
 * 商家 → 顾客 站内信服务（§3.25 / T314）
 * 商家以店铺身份向本店顾客发送站内消息；read_at 由顾客在微信小程序侧读取时写入。
 */

export interface ShopMessage {
  id: string;
  shopId: string;
  fromUserId: string;
  toUserId: string;
  /** 收件顾客昵称（便于后台展示，冗余存储） */
  toUserNick?: string;
  content: string;
  /** 已读时间；null 表示顾客未读 */
  readAt?: string;
  createdAt: string;
}

export interface PaginatedShopMessages {
  items: ShopMessage[];
  total: number;
  page: number;
  pageSize: number;
}

const MSG_FETCH_CAP = 2000;

@Injectable()
export class MessageService {
  /** 发送站内信（商家 → 本店顾客） */
  async sendMessage(
    shopId: string | undefined,
    fromUserId: string | undefined,
    toUserId: string,
    content: string,
  ): Promise<ShopMessage> {
    if (!shopId) throw new BadRequestException('店铺未绑定');
    if (!hasSupabase() || !supabase) throw new BadRequestException('数据库未配置');
    const text = (content || '').trim();
    if (!text) throw new BadRequestException('消息内容不能为空');
    if (text.length > 500) throw new BadRequestException('消息内容不能超过 500 字');

    // 校验收件人是本店顾客（至少在本店下过单）
    const { data: orderCheck } = await supabase
      .from('tf_orders')
      .select('id')
      .eq('shop_id', shopId)
      .eq('user_id', toUserId)
      .limit(1);
    if (!((orderCheck as any[]) || []).length) {
      throw new BadRequestException('该用户不是本店顾客');
    }

    // 取收件人昵称（冗余存储，便于后台展示）
    const { data: u } = await supabase
      .from('tf_users')
      .select('nick_name')
      .eq('id', toUserId)
      .single();

    const { data, error } = await supabase
      .from('tf_messages')
      .insert({
        shop_id: shopId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        content: text,
      })
      .select('id, shop_id, from_user_id, to_user_id, content, read_at, created_at')
      .single();
    if (error || !data) throw new BadRequestException(error?.message || '发送失败');
    return {
      id: (data as any).id,
      shopId: (data as any).shop_id,
      fromUserId: (data as any).from_user_id,
      toUserId: (data as any).to_user_id,
      toUserNick: (u as any)?.nick_name,
      content: (data as any).content,
      readAt: (data as any).read_at || undefined,
      createdAt: (data as any).created_at,
    };
  }

  /** 商家发件箱（可按顾客筛选） */
  async listMessages(
    shopId: string | undefined,
    opts: { toUserId?: string; page?: number; pageSize?: number } = {},
  ): Promise<PaginatedShopMessages> {
    if (!shopId) return { items: [], total: 0, page: 1, pageSize: 20 };
    if (!hasSupabase() || !supabase) return { items: [], total: 0, page: 1, pageSize: 20 };
    const page = Math.max(1, opts.page || 1);
    const pageSize = Math.max(1, opts.pageSize || 20);

    let query = supabase
      .from('tf_messages')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (opts.toUserId) query = query.eq('to_user_id', opts.toUserId);

    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) throw new BadRequestException(error.message);
    const rows = (data as any[]) || [];
    return {
      items: rows.map((m) => ({
        id: m.id,
        shopId: m.shop_id,
        fromUserId: m.from_user_id,
        toUserId: m.to_user_id,
        content: m.content,
        readAt: m.read_at || undefined,
        createdAt: m.created_at,
      })),
      total: count || 0,
      page,
      pageSize,
    };
  }

  /** 标记已读（顾客在微信小程序侧读取时调用；后台亦可用于手动标记） */
  async markRead(
    shopId: string | undefined,
    messageId: string,
  ): Promise<void> {
    if (!shopId || !hasSupabase() || !supabase) throw new BadRequestException('店铺未绑定');
    const { error } = await supabase
      .from('tf_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('shop_id', shopId)
      .is('read_at', null);
    if (error) throw new NotFoundException('消息不存在');
  }
}
