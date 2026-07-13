import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ShopStatus } from '../../common/constants/enums';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import {
  CreateShopDto,
  UpdateShopDto,
  ShopResponseDto,
} from './dto/shop.dto';

const DEFAULT_SHOP_ID = '00000000-0000-0000-0000-000000000001';

// 内存回退数据（仅开发环境，生产环境禁用）
const memoryShops: Map<string, ShopResponseDto> = new Map();

const initMemoryShops = () => {
  if (memoryShops.size > 0) return;
  const now = '2025-06-01T00:00:00Z';
  memoryShops.set(DEFAULT_SHOP_ID, {
    id: DEFAULT_SHOP_ID,
    name: '小买卖烧烤',
    description: '正宗东北烧烤，炭火烤制，香飘十里！',
    address: '北京市朝阳区美食街88号',
    phone: '13800138000',
    logoUrl: '',
    status: ShopStatus.OPEN,
    deliveryRange: 3000,
    deliveryFee: 500,
    minOrderAmount: 0,
    createdAt: now,
    updatedAt: now,
  });
};

@Injectable()
export class ShopService {
  async findById(id: string): Promise<ShopResponseDto> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_shops')
        .select('id, name, description, avatar_url, logo_url, address, phone, status, delivery_range, delivery_fee, min_order_amount, created_at, updated_at')
        .eq('id', id)
        .single();

      if (error || !data) {
        throw new NotFoundException(`店铺 ${id} 不存在`);
      }
      return this.toResponse(data);
    }

    assertMemoryFallbackAllowed('ShopService');
    initMemoryShops();
    const shop = memoryShops.get(id);
    if (!shop) throw new NotFoundException(`店铺 ${id} 不存在`);
    return shop;
  }

  async findAll(): Promise<ShopResponseDto[]> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_shops')
        .select('id, name, description, avatar_url, logo_url, address, phone, status, delivery_range, delivery_fee, min_order_amount, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        throw new BadRequestException(`查询店铺失败: ${error.message}`);
      }
      return (data || []).map(this.toResponse);
    }

    assertMemoryFallbackAllowed('ShopService');
    initMemoryShops();
    return Array.from(memoryShops.values());
  }

  async findOpenShops(): Promise<ShopResponseDto[]> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_shops')
        .select('id, name, description, avatar_url, logo_url, address, phone, status, delivery_range, delivery_fee, min_order_amount, created_at, updated_at')
        .eq('status', ShopStatus.OPEN);

      if (error) {
        throw new BadRequestException(`查询店铺失败: ${error.message}`);
      }
      return (data || []).map(this.toResponse);
    }

    assertMemoryFallbackAllowed('ShopService');
    initMemoryShops();
    return Array.from(memoryShops.values()).filter((s) => s.status === ShopStatus.OPEN);
  }

  async toggleStatus(id: string): Promise<ShopResponseDto> {
    if (hasSupabase() && supabase) {
      const { data: current, error: fetchErr } = await supabase
        .from('tf_shops')
        .select('status')
        .eq('id', id)
        .single();
      if (fetchErr || !current) {
        throw new NotFoundException(`店铺 ${id} 不存在`);
      }

      const newStatus = current.status === ShopStatus.OPEN
        ? ShopStatus.CLOSED
        : ShopStatus.OPEN;

      const { data, error } = await supabase
        .from('tf_shops')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new BadRequestException(`更新店铺状态失败: ${error.message}`);
      }
      return this.toResponse(data);
    }

    assertMemoryFallbackAllowed('ShopService');
    initMemoryShops();
    const shop = memoryShops.get(id);
    if (!shop) throw new NotFoundException(`店铺 ${id} 不存在`);
    shop.status = shop.status === ShopStatus.OPEN ? ShopStatus.CLOSED : ShopStatus.OPEN;
    shop.updatedAt = new Date().toISOString();
    return shop;
  }

  async create(dto: CreateShopDto): Promise<ShopResponseDto> {
    const now = new Date().toISOString();

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_shops')
        .insert({
          name: dto.name,
          description: dto.description || '',
          address: dto.address || '',
          phone: dto.phone || '',
          logo_url: dto.logoUrl || '',
          status: dto.status || ShopStatus.OPEN,
          delivery_range: dto.deliveryRange || 3000,
          delivery_fee: dto.deliveryFee || 500,
          min_order_amount: dto.minOrderAmount || 0,
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestException(`创建店铺失败: ${error.message}`);
      }
      return this.toResponse(data);
    }

    assertMemoryFallbackAllowed('ShopService');
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const shop: ShopResponseDto = {
      id,
      name: dto.name,
      description: dto.description || '',
      address: dto.address || '',
      phone: dto.phone || '',
      logoUrl: dto.logoUrl || '',
      status: dto.status || ShopStatus.OPEN,
      deliveryRange: dto.deliveryRange || 3000,
      deliveryFee: dto.deliveryFee || 500,
      minOrderAmount: dto.minOrderAmount || 0,
      createdAt: now,
      updatedAt: now,
    };
    memoryShops.set(id, shop);
    return shop;
  }

  async update(id: string, dto: UpdateShopDto): Promise<ShopResponseDto> {
    if (hasSupabase() && supabase) {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.address !== undefined) updateData.address = dto.address;
      if (dto.phone !== undefined) updateData.phone = dto.phone;
      if (dto.logoUrl !== undefined) updateData.logo_url = dto.logoUrl;
      if (dto.deliveryRange !== undefined) updateData.delivery_range = dto.deliveryRange;
      if (dto.deliveryFee !== undefined) updateData.delivery_fee = dto.deliveryFee;
      if (dto.minOrderAmount !== undefined) updateData.min_order_amount = dto.minOrderAmount;

      const { data, error } = await supabase
        .from('tf_shops')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        throw new BadRequestException(`更新店铺失败: ${error?.message || '未知错误'}`);
      }
      return this.toResponse(data);
    }

    assertMemoryFallbackAllowed('ShopService');
    initMemoryShops();
    const shop = memoryShops.get(id);
    if (!shop) throw new NotFoundException(`店铺 ${id} 不存在`);
    if (dto.name !== undefined) shop.name = dto.name;
    if (dto.description !== undefined) shop.description = dto.description;
    if (dto.address !== undefined) shop.address = dto.address;
    if (dto.phone !== undefined) shop.phone = dto.phone;
    if (dto.logoUrl !== undefined) shop.logoUrl = dto.logoUrl;
    if (dto.deliveryRange !== undefined) shop.deliveryRange = dto.deliveryRange;
    if (dto.deliveryFee !== undefined) shop.deliveryFee = dto.deliveryFee;
    if (dto.minOrderAmount !== undefined) shop.minOrderAmount = dto.minOrderAmount;
    shop.updatedAt = new Date().toISOString();
    return shop;
  }

  async delete(id: string): Promise<void> {
    if (hasSupabase() && supabase) {
      const { error } = await supabase
        .from('tf_shops')
        .delete()
        .eq('id', id);

      if (error) {
        throw new BadRequestException(`删除店铺失败: ${error.message}`);
      }
      return;
    }

    assertMemoryFallbackAllowed('ShopService');
    initMemoryShops();
    if (!memoryShops.has(id)) {
      throw new NotFoundException(`店铺 ${id} 不存在`);
    }
    memoryShops.delete(id);
  }

  private toResponse(record: any): ShopResponseDto {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      address: record.address,
      phone: record.phone,
      logoUrl: record.logo_url || record.logoUrl || '',
      status: record.status,
      deliveryRange: record.delivery_range || record.deliveryRange || 3000,
      deliveryFee: record.delivery_fee || record.deliveryFee || 500,
      minOrderAmount: record.min_order_amount || record.minOrderAmount || 0,
      createdAt: record.created_at || record.createdAt,
      updatedAt: record.updated_at || record.updatedAt,
    };
  }
}
