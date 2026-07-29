import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import {
  normalizeGeoPoint,
  resolveGeoPoint,
} from '../../common/utils/tencent-map';

export interface AddressRecord {
  id: string;
  userId: string;
  shopId?: string;
  contactName: string;
  contactPhone: string;
  detail: string;
  /** 腾讯地图 GCJ-02 */
  latitude?: number;
  longitude?: number;
  tag?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const memoryAddresses: Map<string, AddressRecord> = new Map();

@Injectable()
export class AddressService {
  private readonly logger = new Logger(AddressService.name);

  private toRecord(row: any): AddressRecord {
    const point = normalizeGeoPoint(row.latitude, row.longitude);
    return {
      id: row.id,
      userId: row.user_id,
      shopId: row.shop_id || undefined,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      detail: row.detail,
      latitude: point?.latitude,
      longitude: point?.longitude,
      tag: row.tag || undefined,
      isDefault: !!row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    };
  }

  async findByUserId(userId: string, shopId?: string): Promise<AddressRecord[]> {
    if (hasSupabase() && supabase) {
      try {
        let query = supabase
          .from('tf_addresses')
          .select('*')
          .eq('user_id', userId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false });

        if (shopId) {
          query = query.or(`shop_id.eq.${shopId},shop_id.is.null`);
        }

        const { data, error } = await query;
        if (error) {
          this.logger.warn(`[Address] Supabase 查询失败，使用内存模式: ${error.message}`);
        } else {
          return (data || []).map((row) => this.toRecord(row));
        }
      } catch (e) {
        this.logger.warn('[Address] Supabase 查询异常，使用内存模式:', e);
      }
    }

    assertMemoryFallbackAllowed('AddressService');
    return Array.from(memoryAddresses.values())
      .filter((a) => {
        if (a.userId !== userId) return false;
        if (!shopId) return true;
        return !a.shopId || a.shopId === shopId;
      })
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  async findByIdForUser(id: string, userId: string): Promise<AddressRecord> {
    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_addresses')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) {
          if (data.user_id !== userId) {
            throw new ForbiddenException('无权访问该地址');
          }
          return this.toRecord(data);
        }
        if (error && error.code !== 'PGRST116') {
          this.logger.warn(`[Address] 查询地址失败: ${error.message}`);
        }
      } catch (e) {
        if (e instanceof ForbiddenException) throw e;
        this.logger.warn('[Address] 查询地址异常，使用内存模式:', e);
      }
    }

    assertMemoryFallbackAllowed('AddressService');
    const addr = memoryAddresses.get(id);
    if (!addr) throw new NotFoundException('地址不存在');
    if (addr.userId !== userId) throw new ForbiddenException('无权访问该地址');
    return addr;
  }

  async create(userId: string, dto: CreateAddressDto): Promise<AddressRecord> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const shouldDefault = !!dto.isDefault;

    if (shouldDefault) {
      await this.clearDefault(userId);
    }

    // 若当前无地址，首条自动默认
    const existing = await this.findByUserId(userId);
    const isDefault = shouldDefault || existing.length === 0;

    const resolved = await resolveGeoPoint({
      address: dto.detail,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    const record: AddressRecord = {
      id,
      userId,
      shopId: dto.shopId,
      contactName: dto.contactName.trim(),
      contactPhone: dto.contactPhone.trim(),
      detail: dto.detail.trim(),
      latitude: resolved?.latitude,
      longitude: resolved?.longitude,
      tag: dto.tag?.trim() || undefined,
      isDefault,
      createdAt: now,
      updatedAt: now,
    };

    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_addresses')
          .insert({
            id,
            user_id: userId,
            shop_id: dto.shopId || null,
            contact_name: record.contactName,
            contact_phone: record.contactPhone,
            detail: record.detail,
            latitude: record.latitude ?? null,
            longitude: record.longitude ?? null,
            tag: record.tag || null,
            is_default: isDefault,
            created_at: now,
            updated_at: now,
          })
          .select('*')
          .single();

        if (error) {
          this.logger.warn(`[Address] 创建失败，使用内存模式: ${error.message}`);
        } else if (data) {
          return this.toRecord(data);
        }
      } catch (e) {
        this.logger.warn('[Address] 创建异常，使用内存模式:', e);
      }
    }

    assertMemoryFallbackAllowed('AddressService');
    if (isDefault) {
      for (const [key, value] of memoryAddresses.entries()) {
        if (value.userId === userId && value.isDefault) {
          memoryAddresses.set(key, { ...value, isDefault: false, updatedAt: now });
        }
      }
    }
    memoryAddresses.set(id, record);
    return record;
  }

  async update(id: string, userId: string, dto: UpdateAddressDto): Promise<AddressRecord> {
    const existing = await this.findByIdForUser(id, userId);
    const now = new Date().toISOString();

    if (dto.isDefault === true) {
      await this.clearDefault(userId, id);
    }

    const nextDetail = dto.detail !== undefined ? dto.detail.trim() : existing.detail;
    const detailChanged = dto.detail !== undefined && nextDetail !== existing.detail;
    const hasIncomingPoint =
      dto.latitude !== undefined || dto.longitude !== undefined;
    let nextPoint = hasIncomingPoint
      ? (await resolveGeoPoint({
          address: nextDetail,
          latitude: dto.latitude !== undefined ? dto.latitude : existing.latitude,
          longitude: dto.longitude !== undefined ? dto.longitude : existing.longitude,
        }))
      : (detailChanged
          ? await resolveGeoPoint({ address: nextDetail })
          : normalizeGeoPoint(existing.latitude, existing.longitude));

    const next: AddressRecord = {
      ...existing,
      shopId: dto.shopId !== undefined ? dto.shopId : existing.shopId,
      contactName: dto.contactName !== undefined ? dto.contactName.trim() : existing.contactName,
      contactPhone: dto.contactPhone !== undefined ? dto.contactPhone.trim() : existing.contactPhone,
      detail: nextDetail,
      latitude: nextPoint?.latitude,
      longitude: nextPoint?.longitude,
      tag: dto.tag !== undefined ? (dto.tag.trim() || undefined) : existing.tag,
      isDefault: dto.isDefault !== undefined ? !!dto.isDefault : existing.isDefault,
      updatedAt: now,
    };

    if (!next.contactName || !next.detail) {
      throw new BadRequestException('联系人与地址不能为空');
    }

    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_addresses')
          .update({
            shop_id: next.shopId || null,
            contact_name: next.contactName,
            contact_phone: next.contactPhone,
            detail: next.detail,
            latitude: next.latitude ?? null,
            longitude: next.longitude ?? null,
            tag: next.tag || null,
            is_default: next.isDefault,
            updated_at: now,
          })
          .eq('id', id)
          .eq('user_id', userId)
          .select('*')
          .single();

        if (error) {
          this.logger.warn(`[Address] 更新失败，使用内存模式: ${error.message}`);
        } else if (data) {
          return this.toRecord(data);
        }
      } catch (e) {
        this.logger.warn('[Address] 更新异常，使用内存模式:', e);
      }
    }

    assertMemoryFallbackAllowed('AddressService');
    if (next.isDefault) {
      for (const [key, value] of memoryAddresses.entries()) {
        if (value.userId === userId && value.id !== id && value.isDefault) {
          memoryAddresses.set(key, { ...value, isDefault: false, updatedAt: now });
        }
      }
    }
    memoryAddresses.set(id, next);
    return next;
  }

  async remove(id: string, userId: string): Promise<void> {
    const existing = await this.findByIdForUser(id, userId);

    if (hasSupabase() && supabase) {
      try {
        const { error } = await supabase
          .from('tf_addresses')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        if (error) {
          this.logger.warn(`[Address] 删除失败，使用内存模式: ${error.message}`);
        } else {
          // 删除默认地址后，将最新一条设为默认
          if (existing.isDefault) {
            const list = await this.findByUserId(userId);
            if (list.length > 0) {
              await this.setDefault(list[0].id, userId);
            }
          }
          return;
        }
      } catch (e) {
        this.logger.warn('[Address] 删除异常，使用内存模式:', e);
      }
    }

    assertMemoryFallbackAllowed('AddressService');
    memoryAddresses.delete(id);
    if (existing.isDefault) {
      const remaining = Array.from(memoryAddresses.values())
        .filter((a) => a.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (remaining[0]) {
        memoryAddresses.set(remaining[0].id, {
          ...remaining[0],
          isDefault: true,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  async setDefault(id: string, userId: string): Promise<AddressRecord> {
    await this.findByIdForUser(id, userId);
    await this.clearDefault(userId, id);

    if (hasSupabase() && supabase) {
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('tf_addresses')
          .update({ is_default: true, updated_at: now })
          .eq('id', id)
          .eq('user_id', userId)
          .select('*')
          .single();
        if (error) {
          this.logger.warn(`[Address] 设默认失败，使用内存模式: ${error.message}`);
        } else if (data) {
          return this.toRecord(data);
        }
      } catch (e) {
        this.logger.warn('[Address] 设默认异常，使用内存模式:', e);
      }
    }

    assertMemoryFallbackAllowed('AddressService');
    const now = new Date().toISOString();
    for (const [key, value] of memoryAddresses.entries()) {
      if (value.userId === userId) {
        memoryAddresses.set(key, {
          ...value,
          isDefault: value.id === id,
          updatedAt: now,
        });
      }
    }
    const updated = memoryAddresses.get(id);
    if (!updated) throw new NotFoundException('地址不存在');
    return updated;
  }

  private async clearDefault(userId: string, exceptId?: string): Promise<void> {
    if (hasSupabase() && supabase) {
      try {
        let query = supabase
          .from('tf_addresses')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('is_default', true);
        if (exceptId) {
          query = query.neq('id', exceptId);
        }
        const { error } = await query;
        if (error) {
          this.logger.warn(`[Address] 清除默认失败: ${error.message}`);
        }
      } catch (e) {
        this.logger.warn('[Address] 清除默认异常:', e);
      }
    }

    // 同步内存
    const now = new Date().toISOString();
    for (const [key, value] of memoryAddresses.entries()) {
      if (value.userId === userId && value.isDefault && value.id !== exceptId) {
        memoryAddresses.set(key, { ...value, isDefault: false, updatedAt: now });
      }
    }
  }
}
