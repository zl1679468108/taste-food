import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ShopStatus } from '../../common/constants/enums';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import {
  CreateShopDto,
  UpdateShopDto,
  ShopResponseDto,
  BusinessHoursResponseDto,
} from './dto/shop.dto';
import {
  VoiceAlertConfig,
  UpdateVoiceAlertConfigDto,
} from './dto/voice-alert-config.dto';
import {
  BusinessHours,
  defaultBusinessHours,
  isWithinBusinessHours,
  normalizeBusinessHours,
  nextOpenHint,
} from './business-hours.util';
import {
  normalizeGeoPoint,
  resolveGeoPoint,
} from '../../common/utils/tencent-map';

const DEFAULT_SHOP_ID = '00000000-0000-0000-0000-000000000001';

const SHOP_SELECT =
  'id, name, description, logo_url, address, latitude, longitude, phone, status, delivery_range, delivery_confirm_radius_m, delivery_fee, min_order_amount, business_hours, created_at, updated_at';

// 内存回退数据（仅开发环境，生产环境禁用）
const memoryShops: Map<string, ShopResponseDto> = new Map();

// 内存回退：语音播报配置（仅开发环境，生产环境禁用）
const memoryVoiceAlertConfigs: Map<string, VoiceAlertConfig> = new Map();

function defaultVoiceAlertConfig(): VoiceAlertConfig {
  return { selection: {}, enabled: true, volume: 1, repeat: 1 };
}

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
    deliveryConfirmRadiusM: 500,
    deliveryFee: 500,
    minOrderAmount: 0,
    businessHours: defaultBusinessHours(),
    createdAt: now,
    updatedAt: now,
  });
};

@Injectable()
export class ShopService {

  private async queryShops(
    build: (select: string) => any,
  ): Promise<{ data: any[] | any | null; error: any | null }> {
    return build(SHOP_SELECT);
  }

  async findById(id: string): Promise<ShopResponseDto> {
    if (hasSupabase() && supabase) {
      const { data, error } = await this.queryShops((select) =>
        supabase!.from('tf_shops').select(select).eq('id', id).single(),
      );

      if (error || !data) {
        throw new NotFoundException(`店铺 ${id} 不存在`);
      }
      return this.toResponse(data);
    }

    assertMemoryFallbackAllowed('ShopService');
    initMemoryShops();
    const shop = memoryShops.get(id);
    if (!shop) throw new NotFoundException(`店铺 ${id} 不存在`);
    return this.withOpenFlag(shop);
  }


  async findAll(): Promise<ShopResponseDto[]> {
    if (hasSupabase() && supabase) {
      const { data, error } = await this.queryShops((select) =>
        supabase!.from('tf_shops').select(select).order('created_at', { ascending: false }),
      );

      if (error) {
        throw new BadRequestException(`查询店铺失败: ${error.message}`);
      }
      return (data || []).map((row: any) => this.toResponse(row));
    }

    assertMemoryFallbackAllowed('ShopService');
    initMemoryShops();
    return Array.from(memoryShops.values()).map((shop) => this.withOpenFlag(shop));
  }

  async findOpenShops(): Promise<ShopResponseDto[]> {
    const shops = await this.findAll();
    return shops.filter((s) => s.isOpenNow);
  }

  async getBusinessHours(id: string): Promise<BusinessHoursResponseDto> {
    const shop = await this.findById(id);
    const businessHours = shop.businessHours || defaultBusinessHours();
    const isOpenNow = isWithinBusinessHours(businessHours, shop.status);
    return {
      shopId: shop.id,
      status: shop.status,
      businessHours,
      isOpenNow,
      nextOpenHint: nextOpenHint(businessHours, shop.status),
    };
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

      const newStatus =
        current.status === ShopStatus.OPEN ? ShopStatus.CLOSED : ShopStatus.OPEN;

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
    return this.withOpenFlag(shop);
  }

  async create(dto: CreateShopDto): Promise<ShopResponseDto> {
    const now = new Date().toISOString();
    const businessHours = dto.businessHours
      ? normalizeBusinessHours(dto.businessHours)
      : defaultBusinessHours();

    if (hasSupabase() && supabase) {
      const resolved = await resolveGeoPoint({
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });
      const insertData: Record<string, unknown> = {
        name: dto.name,
        description: dto.description || '',
        address: dto.address || '',
        latitude: resolved?.latitude ?? null,
        longitude: resolved?.longitude ?? null,
        phone: dto.phone || '',
        logo_url: dto.logoUrl || '',
        status: dto.status || ShopStatus.OPEN,
        delivery_range: dto.deliveryRange ?? 3000,
        delivery_confirm_radius_m: dto.deliveryConfirmRadiusM ?? 500,
        delivery_fee: dto.deliveryFee ?? 500,
        min_order_amount: dto.minOrderAmount ?? 0,
        business_hours: businessHours,
      };

      const { data, error } = await supabase
        .from('tf_shops')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        // 兼容旧库缺列：依次去掉 business_hours / logo_url 再试
        if (error.message?.includes('business_hours') || error.message?.includes('logo_url')) {
          if (error.message?.includes('business_hours')) delete insertData.business_hours;
          if (error.message?.includes('logo_url')) delete insertData.logo_url;
          const retry = await supabase.from('tf_shops').insert(insertData).select().single();
          if (retry.error) {
            if (retry.error.message?.includes('logo_url')) {
              delete insertData.logo_url;
              const retry2 = await supabase.from('tf_shops').insert(insertData).select().single();
              if (retry2.error) {
                throw new BadRequestException(this.formatShopWriteError('创建', retry2.error.message));
              }
              return this.toResponse(retry2.data);
            }
            throw new BadRequestException(this.formatShopWriteError('创建', retry.error.message));
          }
          return this.toResponse(retry.data);
        }
        throw new BadRequestException(this.formatShopWriteError('创建', error.message));
      }
      return this.toResponse(data);
    }

    assertMemoryFallbackAllowed('ShopService');
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const resolvedMem = await resolveGeoPoint({
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    const shop: ShopResponseDto = {
      id,
      name: dto.name,
      description: dto.description || '',
      address: dto.address || '',
      latitude: resolvedMem?.latitude,
      longitude: resolvedMem?.longitude,
      phone: dto.phone || '',
      logoUrl: dto.logoUrl || '',
      status: dto.status || ShopStatus.OPEN,
      deliveryRange: dto.deliveryRange ?? 3000,
      deliveryConfirmRadiusM: dto.deliveryConfirmRadiusM ?? 500,
      deliveryFee: dto.deliveryFee ?? 500,
      minOrderAmount: dto.minOrderAmount ?? 0,
      businessHours,
      createdAt: now,
      updatedAt: now,
    };
    memoryShops.set(id, shop);
    return this.withOpenFlag(shop);
  }

  async update(id: string, dto: UpdateShopDto): Promise<ShopResponseDto> {
    let normalizedHours: BusinessHours | undefined;
    if (dto.businessHours !== undefined) {
      normalizedHours = normalizeBusinessHours(dto.businessHours);
    }

    if (hasSupabase() && supabase) {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.address !== undefined) updateData.address = dto.address;
      if (
        dto.address !== undefined
        || dto.latitude !== undefined
        || dto.longitude !== undefined
      ) {
        // 读取现有坐标，避免仅改文案/geocode 失败时把已有点清空
        let existingLat: number | undefined;
        let existingLng: number | undefined;
        try {
          const current = await this.findById(id);
          existingLat = current.latitude;
          existingLng = current.longitude;
        } catch {
          /* ignore */
        }
        const resolved = await resolveGeoPoint({
          address: dto.address,
          latitude: dto.latitude !== undefined ? dto.latitude : existingLat,
          longitude: dto.longitude !== undefined ? dto.longitude : existingLng,
        });
        if (resolved) {
          updateData.latitude = resolved.latitude;
          updateData.longitude = resolved.longitude;
        } else if (dto.latitude !== undefined || dto.longitude !== undefined) {
          // 显式传空/非法时才清空
          updateData.latitude = null;
          updateData.longitude = null;
        }
      }
      if (dto.phone !== undefined) updateData.phone = dto.phone;
      if (dto.logoUrl !== undefined) updateData.logo_url = dto.logoUrl;
      if (dto.deliveryRange !== undefined) updateData.delivery_range = dto.deliveryRange;
      if (dto.deliveryConfirmRadiusM !== undefined) updateData.delivery_confirm_radius_m = dto.deliveryConfirmRadiusM;
      if (dto.deliveryFee !== undefined) updateData.delivery_fee = dto.deliveryFee;
      if (dto.minOrderAmount !== undefined) updateData.min_order_amount = dto.minOrderAmount;
      if (normalizedHours !== undefined) updateData.business_hours = normalizedHours;

      const { data, error } = await supabase
        .from('tf_shops')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        if (error?.message?.includes('business_hours') && normalizedHours !== undefined) {
          delete updateData.business_hours;
          const retry = await supabase
            .from('tf_shops')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
          if (retry.error || !retry.data) {
            throw new BadRequestException(
              this.formatShopWriteError('更新', retry.error?.message || error?.message),
            );
          }
          const response = this.toResponse(retry.data);
          response.businessHours = normalizedHours;
          return this.withOpenFlag(response);
        }
        throw new BadRequestException(this.formatShopWriteError('更新', error?.message));
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
    if (
      dto.address !== undefined
      || dto.latitude !== undefined
      || dto.longitude !== undefined
    ) {
      const resolved = await resolveGeoPoint({
        address: dto.address !== undefined ? dto.address : shop.address,
        latitude: dto.latitude !== undefined ? dto.latitude : shop.latitude,
        longitude: dto.longitude !== undefined ? dto.longitude : shop.longitude,
      });
      if (resolved) {
        shop.latitude = resolved.latitude;
        shop.longitude = resolved.longitude;
      } else if (dto.latitude !== undefined || dto.longitude !== undefined) {
        shop.latitude = undefined;
        shop.longitude = undefined;
      }
    }
    if (dto.phone !== undefined) shop.phone = dto.phone;
    if (dto.logoUrl !== undefined) shop.logoUrl = dto.logoUrl;
    if (dto.deliveryRange !== undefined) shop.deliveryRange = dto.deliveryRange;
    if (dto.deliveryConfirmRadiusM !== undefined) (shop as any).deliveryConfirmRadiusM = dto.deliveryConfirmRadiusM;
    if (dto.deliveryFee !== undefined) shop.deliveryFee = dto.deliveryFee;
    if (dto.minOrderAmount !== undefined) shop.minOrderAmount = dto.minOrderAmount;
    if (normalizedHours !== undefined) shop.businessHours = normalizedHours;
    shop.updatedAt = new Date().toISOString();
    return this.withOpenFlag(shop);
  }

  async delete(id: string): Promise<void> {
    if (hasSupabase() && supabase) {
      const { error } = await supabase.from('tf_shops').delete().eq('id', id);

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

  // ===== 语音播报配置（T308）=====

  async getVoiceAlertConfig(shopId: string): Promise<VoiceAlertConfig> {
    const fallback = defaultVoiceAlertConfig();
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_shops')
        .select('voice_alert_config')
        .eq('id', shopId)
        .single();
      if (error || !data) return fallback;
      const cfg = data.voice_alert_config;
      if (!cfg) return fallback;
      return {
        selection:
          cfg.selection && typeof cfg.selection === 'object' ? cfg.selection : fallback.selection,
        enabled: typeof cfg.enabled === 'boolean' ? cfg.enabled : fallback.enabled,
        volume:
          typeof cfg.volume === 'number'
            ? Math.min(1, Math.max(0, cfg.volume))
            : fallback.volume,
        repeat:
          typeof cfg.repeat === 'number'
            ? Math.min(3, Math.max(1, Math.round(cfg.repeat)))
            : fallback.repeat,
      };
    }

    assertMemoryFallbackAllowed('ShopService');
    return memoryVoiceAlertConfigs.get(shopId) || fallback;
  }

  async updateVoiceAlertConfig(
    shopId: string,
    dto: UpdateVoiceAlertConfigDto,
  ): Promise<VoiceAlertConfig> {
    const current = await this.getVoiceAlertConfig(shopId);
    const merged: VoiceAlertConfig = {
      selection: dto.selection !== undefined ? dto.selection : current.selection,
      enabled: dto.enabled !== undefined ? dto.enabled : current.enabled,
      volume: dto.volume !== undefined ? dto.volume : current.volume,
      repeat: dto.repeat !== undefined ? dto.repeat : current.repeat,
    };

    if (hasSupabase() && supabase) {
      const { error } = await supabase
        .from('tf_shops')
        .update({ voice_alert_config: merged, updated_at: new Date().toISOString() })
        .eq('id', shopId);
      if (error) {
        throw new BadRequestException(`更新语音播报配置失败: ${error.message}`);
      }
      return merged;
    }

    assertMemoryFallbackAllowed('ShopService');
    memoryVoiceAlertConfigs.set(shopId, merged);
    return merged;
  }

  private withOpenFlag(shop: ShopResponseDto): ShopResponseDto {
    const businessHours = shop.businessHours;
    return {
      ...shop,
      isOpenNow: isWithinBusinessHours(businessHours, shop.status),
      nextOpenHint: nextOpenHint(businessHours, shop.status),
    };
  }


  private formatShopWriteError(action: '创建' | '更新', message?: string): string {
    const raw = message || '未知错误';
    if (
      raw.includes("Could not find the 'latitude' column")
      || raw.includes("Could not find the 'longitude' column")
      || raw.includes('column tf_shops.latitude does not exist')
      || raw.includes('column tf_shops.longitude does not exist')
    ) {
      return (
        `${action}店铺失败: 坐标字段未生效。请确认已执行 docs/migrations/v16-tencent-map-coords.sql，` +
        `并在 Supabase 执行 NOTIFY pgrst, 'reload schema'; 刷新 schema cache。原始错误: ${raw}`
      );
    }
    if (raw.includes('business_hours')) {
      return `${action}店铺失败: 请先执行 business_hours 字段迁移。${raw}`;
    }
    return `${action}店铺失败: ${raw}`;
  }

  private toResponse(record: any): ShopResponseDto {
    let businessHours: BusinessHours | undefined;
    if (record.business_hours != null || record.businessHours != null) {
      try {
        businessHours = normalizeBusinessHours(
          record.business_hours ?? record.businessHours,
        );
      } catch {
        businessHours = defaultBusinessHours();
      }
    }

    const point = normalizeGeoPoint(record.latitude, record.longitude);
    const base: ShopResponseDto = {
      id: record.id,
      name: record.name,
      description: record.description,
      address: record.address,
      latitude: point?.latitude,
      longitude: point?.longitude,
      phone: record.phone,
      logoUrl: record.logo_url || record.logoUrl || '',
      status: record.status,
      // 旧库可能没有配送配置列，回退到系统默认值
      deliveryRange: record.delivery_range ?? record.deliveryRange ?? 3000,
      deliveryConfirmRadiusM: record.delivery_confirm_radius_m ?? record.deliveryConfirmRadiusM ?? 500,
      deliveryFee: record.delivery_fee ?? record.deliveryFee ?? 500,
      minOrderAmount: record.min_order_amount ?? record.minOrderAmount ?? 0,
      businessHours,
      createdAt: record.created_at || record.createdAt,
      updatedAt: record.updated_at || record.updatedAt,
    };
    return this.withOpenFlag(base);
  }
}
