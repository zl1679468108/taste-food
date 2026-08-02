import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { hasSupabase, supabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  PromotionResponseDto,
} from './dto/promotion.dto';
import { PromotionType, PromotionStatus } from '../../common/constants/enums';

interface PromotionRecord {
  id: string;
  shop_id: string;
  type: string;
  name: string;
  description: string;
  rule: any;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// 内存存储（Supabase 不可用时使用）
const memoryPromotions: Map<string, PromotionRecord> = new Map();

@Injectable()
export class PromotionService {
  private normalize(row: any): PromotionRecord {
    return {
      id: row.id,
      shop_id: row.shop_id || row.shopId,
      type: row.type,
      name: row.name,
      description: row.description || '',
      rule: row.rule || {},
      start_date: row.start_date || row.startDate || null,
      end_date: row.end_date || row.endDate || null,
      status: row.status,
      created_at: row.created_at || row.createdAt,
      updated_at: row.updated_at || row.updatedAt,
    };
  }

  private toResponse(record: PromotionRecord): PromotionResponseDto {
    return {
      id: record.id,
      shopId: record.shop_id,
      type: record.type as PromotionType,
      name: record.name,
      description: record.description || undefined,
      rule: record.rule,
      startDate: record.start_date || undefined,
      endDate: record.end_date || undefined,
      status: record.status as PromotionStatus,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  async findAllByShop(shopId: string): Promise<PromotionResponseDto[]> {
    const now = new Date().toISOString();

    if (hasSupabase() && supabase) {
      // 查询条件：status=active AND (start_date IS NULL OR start_date <= now) AND (end_date IS NULL OR end_date > now)
      const { data, error } = await supabase
        .from('tf_promotions')
        .select('*')
        .eq('shop_id', shopId)
        .eq('status', 'active')
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gt.${now}`)
        .order('created_at', { ascending: false });

      if (error) {
        throw new BadRequestException(error.message);
      }

      return (data || []).map((row) => this.toResponse(this.normalize(row)));
    }

    // 内存模式
    assertMemoryFallbackAllowed('PromotionService');
    return Array.from(memoryPromotions.values())
      .filter((p) => p.shop_id === shopId)
      .filter((p) => {
        if (p.status !== 'active') return false;
        if (p.start_date && p.start_date > now) return false;
        if (p.end_date && p.end_date < now) return false;
        return true;
      })
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
      .map(this.toResponse);
  }

  /**
   * 管理端查询店铺的全部促销记录（包含未生效、已过期和已停用活动）。
   * 顾客端继续使用 findAllByShop，避免把管理数据暴露给公开接口。
   */
  async findAllForManagement(shopId: string): Promise<PromotionResponseDto[]> {
    if (!shopId) {
      throw new BadRequestException('缺少店铺归属');
    }

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_promotions')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new BadRequestException(error.message);
      }
      return (data || []).map((row) => this.toResponse(this.normalize(row)));
    }

    assertMemoryFallbackAllowed('PromotionService');
    return Array.from(memoryPromotions.values())
      .filter((p) => p.shop_id === shopId)
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
      .map((p) => this.toResponse(p));
  }

  /**
   * 将时间字符串解析为 epoch 毫秒。
   * null/undefined/空串代表开区间边界，由调用方传入 fallback（-Infinity / +Infinity）。
   * 统一走 Date.parse 转 UTC 时间戳比较，规避字符串字典序比较在时区偏移
   * （如 `2026-01-01T00:00:00+08:00` 与 `2025-12-31T16:00:00Z` 实为同一时刻）下的错误结论。
   */
  private toEpoch(value: string | null | undefined, fallback: number): number {
    if (!value) return fallback;
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) {
      throw new BadRequestException(`时间格式非法: ${value}`);
    }
    return ms;
  }

  /**
   * 半开区间 [start, end) 重叠判定：a.start < b.end && b.start < a.end。
   * 边界相接（前一个活动 end === 后一个活动 start）不算冲突。
   * 无开始时间 => -∞（即刻生效）；无结束时间 => +∞（长期有效），
   * 因此「两个都无结束时间」必然重叠。
   */
  private isOverlapping(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
  ): boolean {
    return aStart < bEnd && bStart < aEnd;
  }

  /**
   * 检测同店铺、同类型、状态为 active 的促销是否与给定时间段重叠。
   * 仅 active 参与判定：停用/过期活动不会实际参与算价，不构成业务冲突。
   *
   * 重叠判定在内存中完成而非下推到 SQL —— null 边界在 SQL 里需要写成
   * 多组 OR (is null / lte / gt) 组合，既难读也容易漏分支。
   */
  async findConflicts(params: {
    shopId: string;
    type: string;
    startTime?: string;
    endTime?: string;
    excludeId?: string;
  }): Promise<PromotionResponseDto[]> {
    const { shopId, type, startTime, endTime, excludeId } = params;

    // 多租户归属校验：没有明确店铺归属直接拒绝，避免退化成全表扫描
    if (!shopId) {
      throw new BadRequestException('缺少店铺归属');
    }
    if (!type) {
      throw new BadRequestException('缺少促销类型 type');
    }

    const targetStart = this.toEpoch(startTime, Number.NEGATIVE_INFINITY);
    const targetEnd = this.toEpoch(endTime, Number.POSITIVE_INFINITY);

    if (targetStart >= targetEnd) {
      throw new BadRequestException('开始时间必须早于结束时间');
    }

    try {
      let candidates: PromotionRecord[];

      if (hasSupabase() && supabase) {
        // shop_id + type + status 三重过滤全部下推，确保 A 店查不到 B 店数据
        const { data, error } = await supabase
          .from('tf_promotions')
          .select('*')
          .eq('shop_id', shopId)
          .eq('type', type)
          .eq('status', PromotionStatus.ACTIVE)
          .order('start_date', { ascending: true });

        if (error) {
          throw new BadRequestException(error.message);
        }
        candidates = (data || []).map((row) => this.normalize(row));
      } else {
        assertMemoryFallbackAllowed('PromotionService');
        candidates = Array.from(memoryPromotions.values()).filter(
          (p) =>
            p.shop_id === shopId &&
            p.type === type &&
            p.status === PromotionStatus.ACTIVE,
        );
      }

      return candidates
        .filter((p) => p.id !== excludeId)
        .filter((p) => {
          const pStart = this.toEpoch(p.start_date, Number.NEGATIVE_INFINITY);
          const pEnd = this.toEpoch(p.end_date, Number.POSITIVE_INFINITY);
          return this.isOverlapping(targetStart, targetEnd, pStart, pEnd);
        })
        .sort((a, b) => {
          const av = this.toEpoch(a.start_date, Number.NEGATIVE_INFINITY);
          const bv = this.toEpoch(b.start_date, Number.NEGATIVE_INFINITY);
          if (av === bv) return 0;
          return av < bv ? -1 : 1;
        })
        .map((p) => this.toResponse(p));
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof NotFoundException) {
        throw e;
      }
      throw new BadRequestException(
        `促销冲突检测失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async findOne(id: string): Promise<PromotionResponseDto> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_promotions')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        throw new NotFoundException(`促销 ${id} 不存在`);
      }
      return this.toResponse(this.normalize(data));
    }

    assertMemoryFallbackAllowed('PromotionService');
    const promo = memoryPromotions.get(id);
    if (!promo) {
      throw new NotFoundException(`促销 ${id} 不存在`);
    }
    return this.toResponse(promo);
  }

  async create(dto: CreatePromotionDto): Promise<PromotionResponseDto> {
    const now = new Date().toISOString();
    const id = uuidv4();

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_promotions')
        .insert({
          id,
          shop_id: dto.shopId,
          type: dto.type,
          name: dto.name,
          description: dto.description || '',
          rule: dto.rule,
          start_date: dto.startDate || null,
          end_date: dto.endDate || null,
          status: dto.status || 'inactive',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestException(error.message);
      }
      return this.toResponse(this.normalize(data));
    }

    // 内存模式
    assertMemoryFallbackAllowed('PromotionService');
    const record: PromotionRecord = {
      id,
      shop_id: dto.shopId,
      type: dto.type,
      name: dto.name,
      description: dto.description || '',
      rule: dto.rule,
      start_date: dto.startDate || null,
      end_date: dto.endDate || null,
      status: dto.status || 'inactive',
      created_at: now,
      updated_at: now,
    };
    memoryPromotions.set(id, record);
    return this.toResponse(record);
  }

  async update(id: string, dto: UpdatePromotionDto, shopId: string): Promise<PromotionResponseDto> {
    const now = new Date().toISOString();

    if (!shopId) {
      throw new NotFoundException(`促销 ${id} 不存在`);
    }

    if (hasSupabase() && supabase) {
      // 先查是否存在
      const { data: existing, error: fetchErr } = await supabase
        .from('tf_promotions')
        .select('id')
        .eq('id', id)
        .eq('shop_id', shopId)
        .single();

      if (fetchErr || !existing) {
        throw new NotFoundException(`促销 ${id} 不存在`);
      }

      const updateData: Record<string, any> = { updated_at: now };
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.rule !== undefined) updateData.rule = dto.rule;
      if (dto.startDate !== undefined) updateData.start_date = dto.startDate;
      if (dto.endDate !== undefined) updateData.end_date = dto.endDate;
      if (dto.status !== undefined) updateData.status = dto.status;

      const { data, error } = await supabase
        .from('tf_promotions')
        .update(updateData)
        .eq('id', id)
        .eq('shop_id', shopId)
        .select()
        .single();

      if (error) {
        throw new BadRequestException(error.message);
      }
      return this.toResponse(this.normalize(data));
    }

    // 内存模式
    assertMemoryFallbackAllowed('PromotionService');
    const record = memoryPromotions.get(id);
    if (!record || record.shop_id !== shopId) {
      throw new NotFoundException(`促销 ${id} 不存在`);
    }

    if (dto.name !== undefined) record.name = dto.name;
    if (dto.description !== undefined) record.description = dto.description;
    if (dto.rule !== undefined) record.rule = dto.rule;
    if (dto.startDate !== undefined) record.start_date = dto.startDate;
    if (dto.endDate !== undefined) record.end_date = dto.endDate;
    if (dto.status !== undefined) record.status = dto.status;
    record.updated_at = now;

    memoryPromotions.set(id, record);
    return this.toResponse(record);
  }

  async remove(id: string, shopId: string): Promise<void> {
    if (!shopId) {
      throw new NotFoundException(`促销 ${id} 不存在`);
    }

    if (hasSupabase() && supabase) {
      const { data: existing, error: fetchErr } = await supabase
        .from('tf_promotions')
        .select('id')
        .eq('id', id)
        .eq('shop_id', shopId)
        .single();

      if (fetchErr || !existing) {
        throw new NotFoundException(`促销 ${id} 不存在`);
      }

      const { error } = await supabase
        .from('tf_promotions')
        .delete()
        .eq('id', id)
        .eq('shop_id', shopId);

      if (error) {
        throw new BadRequestException(error.message);
      }
      return;
    }

    // 内存模式
    assertMemoryFallbackAllowed('PromotionService');
    const record = memoryPromotions.get(id);
    if (!record || record.shop_id !== shopId) {
      throw new NotFoundException(`促销 ${id} 不存在`);
    }
    const deleted = memoryPromotions.delete(id);
    if (!deleted) {
      throw new NotFoundException(`促销 ${id} 不存在`);
    }
  }
}
