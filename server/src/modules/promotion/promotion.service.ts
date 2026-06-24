import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { hasSupabase, supabase } from '../../database/supabase.client';
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
      const { data, error } = await supabase
        .from('tf_promotions')
        .select('*')
        .eq('shop_id', shopId)
        .or(`status.eq.active,end_date.gt.${now}`)
        .order('created_at', { ascending: false });

      if (error) {
        throw new BadRequestException(error.message);
      }

      return (data || []).map((row) => this.toResponse(this.normalize(row)));
    }

    // 内存模式
    return Array.from(memoryPromotions.values())
      .filter((p) => p.shop_id === shopId)
      .filter((p) => {
        if (p.status !== 'active') return false;
        if (p.end_date && p.end_date < now) return false;
        return true;
      })
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
      .map(this.toResponse);
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

  async update(id: string, dto: UpdatePromotionDto): Promise<PromotionResponseDto> {
    const now = new Date().toISOString();

    if (hasSupabase() && supabase) {
      // 先查是否存在
      const { data: existing, error: fetchErr } = await supabase
        .from('tf_promotions')
        .select('id')
        .eq('id', id)
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
        .select()
        .single();

      if (error) {
        throw new BadRequestException(error.message);
      }
      return this.toResponse(this.normalize(data));
    }

    // 内存模式
    const record = memoryPromotions.get(id);
    if (!record) {
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

  async remove(id: string): Promise<void> {
    if (hasSupabase() && supabase) {
      const { error } = await supabase
        .from('tf_promotions')
        .delete()
        .eq('id', id);

      if (error) {
        throw new BadRequestException(error.message);
      }
      return;
    }

    // 内存模式
    const deleted = memoryPromotions.delete(id);
    if (!deleted) {
      throw new NotFoundException(`促销 ${id} 不存在`);
    }
  }
}
