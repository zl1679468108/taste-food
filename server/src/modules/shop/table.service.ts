import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { CreateShopTableDto, ShopTableDto, UpdateShopTableDto } from './dto/table.dto';

interface TableRow {
  id: string;
  shop_id: string;
  table_no: string;
  label?: string | null;
  sort_order?: number | null;
  active?: boolean | null;
  created_at?: string | null;
}

interface MemoryTable {
  id: string;
  shopId: string;
  tableNo: string;
  label: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}

const memoryTables: Map<string, MemoryTable> = new Map();

function buildScanPath(shopId: string, tableNo: string): string {
  const q = `shopId=${encodeURIComponent(shopId)}&tableNo=${encodeURIComponent(tableNo)}&dineIn=1`;
  return `pages/menu/index?${q}`;
}

function toDto(row: MemoryTable | {
  id: string;
  shopId: string;
  tableNo: string;
  label?: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}): ShopTableDto {
  return {
    id: row.id,
    shopId: row.shopId,
    tableNo: row.tableNo,
    label: row.label || undefined,
    sortOrder: row.sortOrder,
    active: row.active,
    scanPath: buildScanPath(row.shopId, row.tableNo),
    createdAt: row.createdAt,
  };
}

function fromDb(row: TableRow): ShopTableDto {
  return toDto({
    id: row.id,
    shopId: row.shop_id,
    tableNo: row.table_no,
    label: row.label || '',
    sortOrder: row.sort_order ?? 0,
    active: row.active !== false,
    createdAt: row.created_at || new Date().toISOString(),
  });
}

function seedDefaults(shopId: string): MemoryTable[] {
  const now = new Date().toISOString();
  const list: MemoryTable[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const no = `A${String(i).padStart(2, '0')}`;
    const item: MemoryTable = {
      id: uuidv4(),
      shopId,
      tableNo: no,
      label: `${no} 桌`,
      sortOrder: i,
      active: true,
      createdAt: now,
    };
    list.push(item);
    memoryTables.set(item.id, item);
  }
  return list;
}

@Injectable()
export class TableService {
  private ensureMemorySeed(shopId: string) {
    const existing = [...memoryTables.values()].filter((t) => t.shopId === shopId);
    if (existing.length === 0) {
      seedDefaults(shopId);
    }
  }

  async list(shopId: string, opts?: { includeInactive?: boolean }): Promise<ShopTableDto[]> {
    const includeInactive = !!opts?.includeInactive;
    if (hasSupabase() && supabase) {
      try {
        let query = supabase
          .from('tf_shop_tables')
          .select('*')
          .eq('shop_id', shopId)
          .order('sort_order', { ascending: true })
          .order('table_no', { ascending: true });
        if (!includeInactive) {
          query = query.eq('active', true);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) {
          // 空表时不自动写库，返回空；管理端可 seed
          return [];
        }
        return (data as TableRow[]).map(fromDb);
      } catch (e) {
        // fall through memory
      }
    }

    assertMemoryFallbackAllowed('shop tables');
    this.ensureMemorySeed(shopId);
    return [...memoryTables.values()]
      .filter((t) => t.shopId === shopId && (includeInactive || t.active))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.tableNo.localeCompare(b.tableNo))
      .map(toDto);
  }

  async create(shopId: string, dto: CreateShopTableDto): Promise<ShopTableDto> {
    const tableNo = dto.tableNo.trim();
    if (!tableNo) throw new BadRequestException('桌号不能为空');

    if (hasSupabase() && supabase) {
      try {
        const row = {
          id: uuidv4(),
          shop_id: shopId,
          table_no: tableNo,
          label: (dto.label || '').trim(),
          sort_order: dto.sortOrder ?? 0,
          active: dto.active !== false,
          created_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('tf_shop_tables').insert(row).select().single();
        if (error) {
          if (String(error.message || '').includes('duplicate') || (error as any).code === '23505') {
            throw new ConflictException('桌号已存在');
          }
          throw error;
        }
        return fromDb(data as TableRow);
      } catch (e) {
        if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
      }
    }

    assertMemoryFallbackAllowed('shop tables create');
    this.ensureMemorySeed(shopId);
    const exists = [...memoryTables.values()].some(
      (t) => t.shopId === shopId && t.tableNo.toLowerCase() === tableNo.toLowerCase(),
    );
    if (exists) throw new ConflictException('桌号已存在');
    const item: MemoryTable = {
      id: uuidv4(),
      shopId,
      tableNo,
      label: (dto.label || '').trim(),
      sortOrder: dto.sortOrder ?? 0,
      active: dto.active !== false,
      createdAt: new Date().toISOString(),
    };
    memoryTables.set(item.id, item);
    return toDto(item);
  }

  async update(shopId: string, tableId: string, dto: UpdateShopTableDto): Promise<ShopTableDto> {
    const nextTableNo = dto.tableNo !== undefined ? dto.tableNo.trim() : undefined;
    if (nextTableNo !== undefined && !nextTableNo) {
      throw new BadRequestException('桌号不能为空');
    }

    if (hasSupabase() && supabase) {
      try {
        const patch: Record<string, unknown> = {};
        if (nextTableNo !== undefined) patch.table_no = nextTableNo;
        if (dto.label !== undefined) patch.label = dto.label.trim();
        if (dto.sortOrder !== undefined) patch.sort_order = dto.sortOrder;
        if (dto.active !== undefined) patch.active = dto.active;
        const { data, error } = await supabase
          .from('tf_shop_tables')
          .update(patch)
          .eq('id', tableId)
          .eq('shop_id', shopId)
          .select()
          .single();
        if (error) {
          if (String(error.message || '').includes('duplicate') || (error as any).code === '23505') {
            throw new ConflictException('桌号已存在');
          }
          throw error;
        }
        if (!data) throw new NotFoundException('桌台不存在');
        return fromDb(data as TableRow);
      } catch (e) {
        if (e instanceof ConflictException || e instanceof NotFoundException) throw e;
      }
    }

    assertMemoryFallbackAllowed('shop tables update');
    const item = memoryTables.get(tableId);
    if (!item || item.shopId !== shopId) throw new NotFoundException('桌台不存在');
    if (nextTableNo !== undefined) {
      const clash = [...memoryTables.values()].some(
        (t) => t.shopId === shopId && t.id !== tableId && t.tableNo.toLowerCase() === nextTableNo.toLowerCase(),
      );
      if (clash) throw new ConflictException('桌号已存在');
      item.tableNo = nextTableNo;
    }
    if (dto.label !== undefined) item.label = dto.label.trim();
    if (dto.sortOrder !== undefined) item.sortOrder = dto.sortOrder;
    if (dto.active !== undefined) item.active = dto.active;
    memoryTables.set(tableId, item);
    return toDto(item);
  }

  async remove(shopId: string, tableId: string): Promise<void> {
    if (hasSupabase() && supabase) {
      try {
        const { error, count } = await supabase
          .from('tf_shop_tables')
          .delete({ count: 'exact' })
          .eq('id', tableId)
          .eq('shop_id', shopId);
        if (error) throw error;
        if (count === 0) throw new NotFoundException('桌台不存在');
        return;
      } catch (e) {
        if (e instanceof NotFoundException) throw e;
      }
    }

    assertMemoryFallbackAllowed('shop tables delete');
    const item = memoryTables.get(tableId);
    if (!item || item.shopId !== shopId) throw new NotFoundException('桌台不存在');
    memoryTables.delete(tableId);
  }

  async seed(shopId: string): Promise<ShopTableDto[]> {
    const existing = await this.list(shopId, { includeInactive: true });
    if (existing.length > 0) {
      return existing;
    }

    if (hasSupabase() && supabase) {
      try {
        const rows = Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const no = `A${String(n).padStart(2, '0')}`;
          return {
            id: uuidv4(),
            shop_id: shopId || DEFAULT_SHOP_ID,
            table_no: no,
            label: `${no} 桌`,
            sort_order: n,
            active: true,
            created_at: new Date().toISOString(),
          };
        });
        const { data, error } = await supabase.from('tf_shop_tables').insert(rows).select();
        if (error) throw error;
        return (data as TableRow[]).map(fromDb);
      } catch {
        // memory
      }
    }

    assertMemoryFallbackAllowed('shop tables seed');
    // clear old for shop then seed
    for (const [id, t] of [...memoryTables.entries()]) {
      if (t.shopId === shopId) memoryTables.delete(id);
    }
    return seedDefaults(shopId).map(toDto);
  }
}
