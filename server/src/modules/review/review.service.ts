import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus } from '../../common/constants/enums';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import { hasSupabase, supabase } from '../../database/supabase.client';
import { OrderService } from '../order/order.service';
import { CreateReviewDto } from './dto/create-review.dto';

export interface ReviewRecord {
  id: string;
  orderId: string;
  shopId: string;
  userId: string;
  rating: number;
  content: string;
  replyContent?: string;
  replyAt?: string;
  createdAt: string;
}

interface ReviewRow {
  id: string;
  order_id: string;
  shop_id: string;
  user_id: string;
  rating: number;
  content: string | null;
  reply_content?: string | null;
  reply_at?: string | null;
  created_at: string;
}

// 开发环境内存回退（key: orderId，保证一单一评）
const memoryReviews = new Map<string, ReviewRecord>();

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(private readonly orderService: OrderService) {}

  private toRecord(row: ReviewRow): ReviewRecord {
    return {
      id: row.id,
      orderId: row.order_id,
      shopId: row.shop_id,
      userId: row.user_id,
      rating: row.rating,
      content: row.content || '',
      replyContent: row.reply_content || undefined,
      replyAt: row.reply_at || undefined,
      createdAt: row.created_at,
    };
  }

  async createForOrder(
    orderId: string,
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewRecord> {
    const order = await this.orderService.findById(orderId);

    if (order.userId !== userId) {
      throw new ForbiddenException('只能评价自己的订单');
    }
    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('仅已完成订单可评价');
    }

    const existing = await this.findByOrderId(orderId);
    if (existing) {
      throw new ConflictException('该订单已评价，不可重复提交');
    }

    const rating = Math.round(Number(dto.rating));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('评分须为 1-5 的整数');
    }

    const content = (dto.content || '').trim();
    if (content.length > 500) {
      throw new BadRequestException('评价内容不能超过 500 字');
    }

    const record: ReviewRecord = {
      id: uuidv4(),
      orderId,
      shopId: order.shopId,
      userId,
      rating,
      content,
      createdAt: new Date().toISOString(),
    };

    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_reviews')
          .insert({
            id: record.id,
            order_id: record.orderId,
            shop_id: record.shopId,
            user_id: record.userId,
            rating: record.rating,
            content: record.content,
            created_at: record.createdAt,
          })
          .select('*')
          .single();

        if (error) {
          // unique 冲突
          if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
            throw new ConflictException('该订单已评价，不可重复提交');
          }
          this.logger.warn(`[Review] 写入失败，回退内存: ${error.message}`);
        } else if (data) {
          void this.orderService.notifyShopStaff({
            shopId: order.shopId,
            type: 'new_review',
            title: '新的顾客评价',
            content: `订单 ${order.orderNo} 收到 ${rating} 星评价${content ? `：${content}` : ''}`,
            relatedId: orderId,
          });
          return this.toRecord(data as ReviewRow);
        }
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        this.logger.warn('[Review] 写入异常，回退内存:', e);
      }
    }

    assertMemoryFallbackAllowed('ReviewService');
    memoryReviews.set(orderId, record);
    void this.orderService.notifyShopStaff({
      shopId: order.shopId,
      type: 'new_review',
      title: '新的顾客评价',
      content: `订单 ${order.orderNo} 收到 ${rating} 星评价${content ? `：${content}` : ''}`,
      relatedId: orderId,
    });
    return record;
  }

  async findByOrderId(orderId: string): Promise<ReviewRecord | null> {
    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_reviews')
          .select('*')
          .eq('order_id', orderId)
          .maybeSingle();

        if (error) {
          this.logger.warn(`[Review] 查询失败，回退内存: ${error.message}`);
        } else if (data) {
          return this.toRecord(data as ReviewRow);
        } else {
          // Supabase 明确无记录时仍检查内存（兼容写入走内存的开发场景）
          return memoryReviews.get(orderId) || null;
        }
      } catch (e) {
        this.logger.warn('[Review] 查询异常，回退内存:', e);
      }
    }

    assertMemoryFallbackAllowed('ReviewService');
    return memoryReviews.get(orderId) || null;
  }

  async listByShop(
    shopId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedData<ReviewRecord>> {
    const safePage = Math.max(page, 1);
    const safeSize = Math.min(Math.max(pageSize, 1), 50);

    if (hasSupabase() && supabase) {
      try {
        const from = (safePage - 1) * safeSize;
        const to = from + safeSize - 1;
        const { data, error, count } = await supabase
          .from('tf_reviews')
          .select('*', { count: 'exact' })
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          this.logger.warn(`[Review] 列表查询失败，回退内存: ${error.message}`);
        } else {
          return {
            items: (data || []).map((row) => this.toRecord(row as ReviewRow)),
            total: count || 0,
            page: safePage,
            pageSize: safeSize,
          };
        }
      } catch (e) {
        this.logger.warn('[Review] 列表查询异常，回退内存:', e);
      }
    }

    assertMemoryFallbackAllowed('ReviewService');
    const all = Array.from(memoryReviews.values())
      .filter((r) => r.shopId === shopId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = all.length;
    const start = (safePage - 1) * safeSize;
    return {
      items: all.slice(start, start + safeSize),
      total,
      page: safePage,
      pageSize: safeSize,
    };
  }

  async listByUser(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedData<ReviewRecord>> {
    const safePage = Math.max(page, 1);
    const safeSize = Math.min(Math.max(pageSize, 1), 50);
    const uid = String(userId || '').trim();
    if (!uid) {
      return { items: [], total: 0, page: safePage, pageSize: safeSize };
    }

    if (hasSupabase() && supabase) {
      try {
        const from = (safePage - 1) * safeSize;
        const to = from + safeSize - 1;
        const { data, error, count } = await supabase
          .from('tf_reviews')
          .select('*', { count: 'exact' })
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          this.logger.warn(`[Review] 用户评价列表查询失败，回退内存: ${error.message}`);
        } else {
          return {
            items: (data || []).map((row) => this.toRecord(row as ReviewRow)),
            total: count || 0,
            page: safePage,
            pageSize: safeSize,
          };
        }
      } catch (e) {
        this.logger.warn('[Review] 用户评价列表查询异常，回退内存:', e);
      }
    }

    assertMemoryFallbackAllowed('ReviewService');
    const all = Array.from(memoryReviews.values())
      .filter((r) => r.userId === uid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = all.length;
    const start = (safePage - 1) * safeSize;
    return {
      items: all.slice(start, start + safeSize),
      total,
      page: safePage,
      pageSize: safeSize,
    };
  }

  async replyToReview(
    reviewId: string,
    shopId: string,
    reply: string,
  ): Promise<ReviewRecord> {
    const text = (reply || '').trim();
    if (!text) {
      throw new BadRequestException('回复内容不能为空');
    }
    if (text.length > 500) {
      throw new BadRequestException('回复不能超过 500 字');
    }

    const replyAt = new Date().toISOString();

    if (hasSupabase() && supabase) {
      try {
        const { data: existing, error: findErr } = await supabase
          .from('tf_reviews')
          .select('*')
          .eq('id', reviewId)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!existing) {
          throw new BadRequestException('评价不存在');
        }
        if ((existing as ReviewRow).shop_id !== shopId) {
          throw new ForbiddenException('无权回复其他店铺评价');
        }
        const { data, error } = await supabase
          .from('tf_reviews')
          .update({ reply_content: text, reply_at: replyAt })
          .eq('id', reviewId)
          .eq('shop_id', shopId)
          .select('*')
          .single();
        if (error) {
          // 兼容尚未迁移 reply 列
          if (/reply_content|reply_at|column/i.test(error.message || '')) {
            this.logger.warn(`[Review] reply 列缺失，回退内存: ${error.message}`);
          } else {
            throw error;
          }
        } else if (data) {
          return this.toRecord(data as ReviewRow);
        }
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof ForbiddenException) throw e;
        this.logger.warn(`[Review] 回复写入失败，回退内存: ${(e as Error).message}`);
      }
    }

    assertMemoryFallbackAllowed('review reply');
    // memory: find by id
    let found: ReviewRecord | undefined;
    for (const r of memoryReviews.values()) {
      if (r.id === reviewId) {
        found = r;
        break;
      }
    }
    if (!found) {
      // also search by iterating orderId keys - already by values
      throw new BadRequestException('评价不存在');
    }
    if (found.shopId !== shopId) {
      throw new ForbiddenException('无权回复其他店铺评价');
    }
    found.replyContent = text;
    found.replyAt = replyAt;
    memoryReviews.set(found.orderId, found);
    return found;
  }

}
