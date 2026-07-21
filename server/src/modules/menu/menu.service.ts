import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MenuItemStatus } from '../../common/constants/enums';
import {
  CreateCategoryDto,
  CategoryResponseDto,
} from './dto/category.dto';
import {
  CreateMenuItemDto,
  MenuItemResponseDto,
} from './dto/menu-item.dto';
import { SpecGroupResponseDto, SpecOptionResponseDto } from './dto/spec.dto';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { FavoritesService } from '../favorites/favorites.service';

interface CategoryRecord {
  id: string;
  shopId: string;
  name: string;
  sortOrder: number;
  iconKey?: string;
  createdAt: string;
  updatedAt: string;
}

interface MenuItemRecord {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  price: number;
  imageUrl?: string;
  description?: string;
  status: MenuItemStatus;
  salesCount: number;
  specGroupIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface SpecGroupRecord {
  id: string;
  shopId: string;
  name: string;
  isRequired: boolean;
  maxSelect: number;
  options: SpecOptionResponseDto[];
  createdAt: string;
  updatedAt: string;
}

// Supabase 行类型
interface CategoryRow {
  id: string;
  shop_id: string;
  name: string;
  sort_order?: number;
  icon_key?: string;
  created_at: string;
  updated_at: string;
}

interface MenuItemRow {
  id: string;
  shop_id: string;
  category_id: string;
  name: string;
  price: number;
  image_url?: string;
  description?: string;
  status?: string;
  monthly_sales?: number;
  sales_count?: number;
  spec_group_ids?: string[];
  created_at: string;
  updated_at: string;
}

interface SpecGroupRow {
  id: string;
  shop_id: string;
  name: string;
  is_required?: boolean;
  max_select?: number;
  created_at: string;
  updated_at: string;
}

// Memory fallback（仅开发环境使用，生产环境禁用）
const DEFAULT_SHOP_ID = '00000000-0000-0000-0000-000000000001';

const memoryCategories: Map<string, CategoryRecord> = new Map();
const memoryMenuItems: Map<string, MenuItemRecord> = new Map();
const memorySpecGroups: Map<string, SpecGroupRecord> = new Map();
const memoryFavorites: Set<string> = new Set(); // 模拟收藏关系 "userId:menuItemId"

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    @Inject(forwardRef(() => FavoritesService))
    private readonly favoritesService: FavoritesService,
  ) {}
  private toCategory(record: CategoryRow): CategoryRecord {
    return {
      id: record.id,
      shopId: record.shop_id,
      name: record.name,
      sortOrder: record.sort_order ?? 0,
      iconKey: record.icon_key,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private toMenuItem(record: MenuItemRow): MenuItemRecord {
    return {
      id: record.id,
      shopId: record.shop_id,
      categoryId: record.category_id,
      name: record.name,
      price: record.price,
      imageUrl: record.image_url,
      description: record.description,
      status: (record.status as MenuItemStatus) || MenuItemStatus.ACTIVE,
      salesCount: record.monthly_sales || record.sales_count || 0,
      specGroupIds: record.spec_group_ids || [],
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private toSpecGroup(record: SpecGroupRow): SpecGroupRecord {
    return {
      id: record.id,
      shopId: record.shop_id,
      name: record.name,
      isRequired: record.is_required ?? false,
      maxSelect: record.max_select ?? 1,
      options: [],
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private async seedIfEmpty(): Promise<void> {
    if (memoryCategories.size > 0) return;

    const shopId = DEFAULT_SHOP_ID;
    const now = new Date().toISOString();

    // Seed spec groups
    const spiceGroupId = uuidv4();
    const roastGroupId = uuidv4();
    const spiceOptionIds = [uuidv4(), uuidv4(), uuidv4()];
    const roastOptionIds = [uuidv4(), uuidv4(), uuidv4()];

    memorySpecGroups.set(spiceGroupId, {
      id: spiceGroupId, shopId, name: '辣度', isRequired: true, maxSelect: 1,
      options: [
        { id: spiceOptionIds[0], specGroupId: spiceGroupId, name: '不辣', priceAdjust: 0, isDefault: true, createdAt: now, updatedAt: now },
        { id: spiceOptionIds[1], specGroupId: spiceGroupId, name: '微辣', priceAdjust: 0, isDefault: false, createdAt: now, updatedAt: now },
        { id: spiceOptionIds[2], specGroupId: spiceGroupId, name: '特辣', priceAdjust: 0, isDefault: false, createdAt: now, updatedAt: now },
      ],
      createdAt: now, updatedAt: now,
    });

    memorySpecGroups.set(roastGroupId, {
      id: roastGroupId, shopId, name: '烤制程度', isRequired: true, maxSelect: 1,
      options: [
        { id: roastOptionIds[0], specGroupId: roastGroupId, name: '标准', priceAdjust: 0, isDefault: true, createdAt: now, updatedAt: now },
        { id: roastOptionIds[1], specGroupId: roastGroupId, name: '焦香', priceAdjust: 0, isDefault: false, createdAt: now, updatedAt: now },
        { id: roastOptionIds[2], specGroupId: roastGroupId, name: '嫩烤', priceAdjust: 200, isDefault: false, createdAt: now, updatedAt: now },
      ],
      createdAt: now, updatedAt: now,
    });

    // Seed categories
    const catNames = ['招牌推荐', '烤肉类', '素菜类', '酒水类', '主食类'];
    const catIds: string[] = [];
    for (let i = 0; i < catNames.length; i++) {
      const id = uuidv4();
      catIds.push(id);
      memoryCategories.set(id, {
        id, shopId, name: catNames[i], sortOrder: i, iconKey: '',
        createdAt: now, updatedAt: now,
      });
    }

    // Seed menu items
    const items: Partial<MenuItemRecord>[] = [
      { categoryId: catIds[0], name: '秘制烤羊排', price: 6800, description: '精选内蒙古羊排，秘制配方腌制', salesCount: 188, specGroupIds: [spiceGroupId, roastGroupId] },
      { categoryId: catIds[0], name: '招牌烤鸡翅', price: 1800, description: '奥尔良风味，外焦里嫩', salesCount: 256 },
      { categoryId: catIds[1], name: '炭烤牛肉串', price: 3000, description: '新鲜牛肉，炭火慢烤', salesCount: 320, specGroupIds: [spiceGroupId, roastGroupId] },
      { categoryId: catIds[1], name: '香辣羊肉串', price: 2500, description: '孜然香辣，回味无穷', salesCount: 280, specGroupIds: [spiceGroupId] },
      { categoryId: catIds[1], name: '蜜汁烤排骨', price: 3500, description: '蜜汁腌制，甜香可口', salesCount: 156, specGroupIds: [spiceGroupId, roastGroupId] },
      { categoryId: catIds[2], name: '烤茄子', price: 800, description: '蒜蓉烤茄子，软糯入味', salesCount: 198, specGroupIds: [roastGroupId] },
      { categoryId: catIds[2], name: '烤金针菇', price: 600, description: '锡纸金针菇，鲜嫩多汁', salesCount: 175 },
      { categoryId: catIds[3], name: '冰镇啤酒', price: 1500, description: '清爽解腻', salesCount: 420 },
      { categoryId: catIds[4], name: '炒饭', price: 1200, description: '粒粒分明', salesCount: 310 },
    ];

    for (const item of items) {
      const id = uuidv4();
      memoryMenuItems.set(id, {
        id, shopId, status: MenuItemStatus.ACTIVE, specGroupIds: item.specGroupIds || [],
        ...item as Omit<MenuItemRecord, 'id' | 'shopId' | 'status' | 'specGroupIds'>,
        createdAt: now, updatedAt: now,
      });
    }
  }

  async createCategory(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const now = new Date().toISOString();
    const id = uuidv4();

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_categories')
        .insert({
          id,
          shop_id: dto.shopId,
          name: dto.name,
          sort_order: dto.sortOrder ?? 0,
          icon_key: dto.iconKey || '',
        })
        .select()
        .single();
      if (error) throw new BadRequestException(`创建分类失败: ${error.message}`);
      return this.toCategoryResponse(this.toCategory(data));
    }

    const category: CategoryRecord = {
      id, shopId: dto.shopId, name: dto.name,
      sortOrder: dto.sortOrder ?? 0, iconKey: dto.iconKey,
      createdAt: now, updatedAt: now,
    };
    memoryCategories.set(id, category);
    return this.toCategoryResponse(category);
  }

  /**
   * 获取热门菜品排行（按 monthly_sales 降序）
   */
  async getPopularItems(shopId?: string, limit: number = 10, userId?: string): Promise<MenuItemResponseDto[]> {
    if (hasSupabase() && supabase) {
      let query = supabase
        .from('tf_menu_items')
        .select('id, category_id, shop_id, name, description, price, image_url, status, monthly_sales, spec_group_ids, created_at, updated_at')
        .eq('status', MenuItemStatus.ACTIVE)
        .order('monthly_sales', { ascending: false })
        .limit(limit);
      if (shopId) query = query.eq('shop_id', shopId);
      const { data, error } = await query;
      if (error) throw new BadRequestException(`获取热门菜品失败: ${error.message}`);
      const items = (data || []).map((row) => this.toMenuItem(row));
      // 批量查询收藏状态，避免逐菜品 N+1 查询
      const favoriteSet = userId
        ? await this.favoritesService.batchCheckFavorites(userId, items.map((i) => i.id))
        : undefined;
      return await Promise.all(items.map((i) => this.toMenuItemResponse(i, userId, favoriteSet)));
    }

    // Memory fallback
    await this.seedIfEmpty();
    let items = Array.from(memoryMenuItems.values()).filter(
      (i) => i.status === MenuItemStatus.ACTIVE,
    );
    if (shopId) items = items.filter((i) => i.shopId === shopId);
    items.sort((a, b) => b.salesCount - a.salesCount);
    const sliced = items.slice(0, limit);
    // 内存模式：直接用本地 Set 批量判断
    const favoriteSet = userId
      ? new Set(sliced.filter((i) => memoryFavorites.has(`${userId}:${i.id}`)).map((i) => i.id))
      : undefined;
    return await Promise.all(sliced.map((i) => this.toMenuItemResponse(i, userId, favoriteSet)));
  }

  async getAllCategories(shopId?: string): Promise<CategoryResponseDto[]> {
    const sid = shopId || DEFAULT_SHOP_ID;
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_categories')
        .select('id, shop_id, name, icon_key, sort_order, created_at, updated_at')
        .eq('shop_id', sid)
        .order('sort_order');
      if (error) throw new BadRequestException(`获取分类失败: ${error.message}`);
      return (data || []).map((row) => this.toCategoryResponse(this.toCategory(row)));
    }

    await this.seedIfEmpty();
    return Array.from(memoryCategories.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => this.toCategoryResponse(c));
  }

  async getMenuItems(categoryId?: string, search?: string, shopId?: string, userId?: string): Promise<MenuItemResponseDto[]> {
    const sid = shopId || DEFAULT_SHOP_ID;
    if (hasSupabase() && supabase) {
      let query = supabase.from('tf_menu_items').select('id, category_id, shop_id, name, description, price, image_url, status, monthly_sales, spec_group_ids, created_at, updated_at').eq('shop_id', sid).order('id');
      if (categoryId) query = query.eq('category_id', categoryId);
      // 转义 PostgreSQL LIKE/ILIKE 通配符（%、_、\），避免用户输入破坏查询模式
      if (search) {
        const escaped = search.replace(/[%_\\]/g, '\\$&');
        query = query.ilike('name', `%${escaped}%`);
      }
      const { data, error } = await query;
      if (error) throw new BadRequestException(`获取菜品失败: ${error.message}`);
      const items = (data || []).map((row) => this.toMenuItem(row));
      // 批量查询收藏状态，避免逐菜品 N+1 查询
      const favoriteSet = userId
        ? await this.favoritesService.batchCheckFavorites(userId, items.map((i) => i.id))
        : undefined;
      return await Promise.all(items.map((i) => this.toMenuItemResponse(i, userId, favoriteSet)));
    }

    await this.seedIfEmpty();
    let items = Array.from(memoryMenuItems.values()).filter((i) => i.shopId === sid);
    if (categoryId) items = items.filter((i) => i.categoryId === categoryId);
    if (search) items = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    // 内存模式：直接用本地 Set 批量判断
    const favoriteSet = userId
      ? new Set(items.filter((i) => memoryFavorites.has(`${userId}:${i.id}`)).map((i) => i.id))
      : undefined;
    return await Promise.all(items.map((i) => this.toMenuItemResponse(i, userId, favoriteSet)));
  }

  async getMenuItemById(id: string, userId?: string): Promise<MenuItemResponseDto> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_menu_items')
        .select('id, category_id, shop_id, name, description, price, image_url, status, monthly_sales, spec_group_ids, created_at, updated_at')
        .eq('id', id)
        .single();
      if (error || !data) throw new NotFoundException(`菜品 ${id} 不存在`);
      return await this.toMenuItemResponse(this.toMenuItem(data), userId);
    }

    const item = memoryMenuItems.get(id);
    if (!item) throw new NotFoundException(`菜品 ${id} 不存在`);
    return await this.toMenuItemResponse(item, userId);
  }

  async getMenuItemSpecs(menuItemId: string): Promise<SpecGroupResponseDto[]> {
    const item = hasSupabase() && supabase
      ? await this.getMenuItemById(menuItemId)
      : memoryMenuItems.get(menuItemId);
    if (!item) throw new NotFoundException(`菜品不存在`);

    // Check if item has spec groups
    if (hasSupabase() && supabase) {
      const { data: row } = await supabase
        .from('tf_menu_items')
        .select('spec_group_ids')
        .eq('id', menuItemId)
        .single();
      if (!row?.spec_group_ids || row.spec_group_ids.length === 0) return [];

      const specIds = row.spec_group_ids;
      const { data: specs, error } = await supabase
        .from('tf_spec_groups')
        .select(`*, tf_spec_options(*)`)
        .in('id', specIds);
      if (error) return [];
      return (specs || []).map((sg: any) => this.toSpecGroupResponse(sg));
    }

    const menuItem = memoryMenuItems.get(menuItemId);
    if (!menuItem || menuItem.specGroupIds.length === 0) return [];

    return menuItem.specGroupIds
      .map((sgId) => memorySpecGroups.get(sgId))
      .filter(Boolean)
      .map((sg) => this.toSpecGroupResponse(sg!));
  }

  async createMenuItem(dto: CreateMenuItemDto): Promise<MenuItemResponseDto> {
    const now = new Date().toISOString();
    const id = uuidv4();

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_menu_items')
        .insert({
          id,
          shop_id: dto.shopId,
          category_id: dto.categoryId,
          name: dto.name,
          price: dto.price,
          image_url: dto.imageUrl || '',
          description: dto.description || '',
          status: dto.status || MenuItemStatus.ACTIVE,
          monthly_sales: dto.salesCount || 0,
        })
        .select()
        .single();
      if (error) throw new BadRequestException(`创建菜品失败: ${error.message}`);
      return await this.toMenuItemResponse(this.toMenuItem(data));
    }

    const menuItem: MenuItemRecord = {
      id, shopId: dto.shopId, categoryId: dto.categoryId,
      name: dto.name, price: dto.price,
      imageUrl: dto.imageUrl || '', description: dto.description || '',
      status: (dto.status as MenuItemStatus) || MenuItemStatus.ACTIVE,
      salesCount: dto.salesCount || 0, specGroupIds: dto.specGroupIds || [],
      createdAt: now, updatedAt: now,
    };
    memoryMenuItems.set(id, menuItem);
    return await this.toMenuItemResponse(menuItem);
  }

  async updateCategory(
    id: string,
    dto: Partial<CreateCategoryDto>,
  ): Promise<CategoryResponseDto> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_categories')
        .update({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.sortOrder !== undefined && { sort_order: dto.sortOrder }),
          ...(dto.iconKey !== undefined && { icon_key: dto.iconKey }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new BadRequestException(`更新分类失败: ${error.message}`);
      return this.toCategoryResponse(this.toCategory(data));
    }

    const category = memoryCategories.get(id);
    if (!category) throw new NotFoundException(`分类 ${id} 不存在`);

    const updated: CategoryRecord = {
      ...category,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.iconKey !== undefined && { iconKey: dto.iconKey }),
      updatedAt: new Date().toISOString(),
    };
    memoryCategories.set(id, updated);
    return this.toCategoryResponse(updated);
  }

  async deleteCategory(id: string): Promise<void> {
    if (hasSupabase() && supabase) {
      // 使用 RPC 事务：在一个原子操作内删除关联菜品和分类，避免中间失败导致数据不一致
      const { error } = await supabase.rpc('atomic_delete_category', {
        p_category_id: id,
      });
      if (error) throw new BadRequestException(`删除分类失败: ${error.message}`);
      return;
    }

    const category = memoryCategories.get(id);
    if (!category) throw new NotFoundException(`分类 ${id} 不存在`);

    for (const [itemId, item] of memoryMenuItems.entries()) {
      if (item.categoryId === id) {
        memoryMenuItems.delete(itemId);
      }
    }
    memoryCategories.delete(id);
  }

  async updateMenuItem(
    id: string,
    dto: Partial<CreateMenuItemDto>,
  ): Promise<MenuItemResponseDto> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_menu_items')
        .update({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.categoryId !== undefined && { category_id: dto.categoryId }),
          ...(dto.imageUrl !== undefined && { image_url: dto.imageUrl }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.salesCount !== undefined && { monthly_sales: dto.salesCount }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new BadRequestException(`更新菜品失败: ${error.message}`);
      return await this.toMenuItemResponse(this.toMenuItem(data));
    }

    const menuItem = memoryMenuItems.get(id);
    if (!menuItem) throw new NotFoundException(`菜品 ${id} 不存在`);

    const updated: MenuItemRecord = {
      ...menuItem,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.status !== undefined && { status: dto.status as MenuItemStatus }),
      ...(dto.salesCount !== undefined && { salesCount: dto.salesCount }),
      updatedAt: new Date().toISOString(),
    };
    memoryMenuItems.set(id, updated);
    return await this.toMenuItemResponse(updated);
  }

  async deleteMenuItem(id: string): Promise<void> {
    if (hasSupabase() && supabase) {
      const { error } = await supabase
        .from('tf_menu_items')
        .delete()
        .eq('id', id);
      if (error) throw new BadRequestException(`删除菜品失败: ${error.message}`);
      return;
    }

    const menuItem = memoryMenuItems.get(id);
    if (!menuItem) throw new NotFoundException(`菜品 ${id} 不存在`);
    memoryMenuItems.delete(id);
  }

  /**
   * 切换收藏状态
   */
  async toggleFavorite(menuItemId: string, userId: string): Promise<boolean> {
    if (hasSupabase() && supabase) {
      try {
        const item = await this.getMenuItemById(menuItemId);
        const result = await this.favoritesService.toggleFavorite(userId, menuItemId, item.shopId);
        return result.isFavorite;
      } catch (e) {
        this.logger.warn('[Menu] 收藏操作失败:', e instanceof Error ? e.message : e);
        return false;
      }
    }
    const key = `${userId}:${menuItemId}`;
    if (memoryFavorites.has(key)) {
      memoryFavorites.delete(key);
      return false;
    } else {
      memoryFavorites.add(key);
      return true;
    }
  }

  /**
   * 检查是否收藏
   */
  async isItemFavorite(menuItemId: string, userId: string): Promise<boolean> {
    if (hasSupabase() && supabase) {
      try {
        return await this.favoritesService.checkFavorite(userId, menuItemId);
      } catch (e) {
        this.logger.warn('[Menu] 检查收藏失败:', e instanceof Error ? e.message : e);
        return false;
      }
    }
    return memoryFavorites.has(`${userId}:${menuItemId}`);
  }

  private toCategoryResponse(record: CategoryRecord): CategoryResponseDto {
    return {
      id: record.id, shopId: record.shopId, name: record.name,
      sortOrder: record.sortOrder, iconKey: record.iconKey,
      createdAt: record.createdAt, updatedAt: record.updatedAt,
    };
  }

  private async toMenuItemResponse(
    record: MenuItemRecord,
    userId?: string,
    favoriteSet?: Set<string>,
  ): Promise<MenuItemResponseDto> {
    return {
      id: record.id, shopId: record.shopId, categoryId: record.categoryId,
      name: record.name, price: record.price,
      imageUrl: record.imageUrl, description: record.description,
      status: record.status, salesCount: record.salesCount,
      specGroupIds: record.specGroupIds.length > 0 ? record.specGroupIds : undefined,
      // 传入 favoriteSet 时直接内存判断，避免逐菜品 N+1 查询
      isFavorite: userId
        ? (favoriteSet ? favoriteSet.has(record.id) : await this.isItemFavorite(record.id, userId))
        : false,
      createdAt: record.createdAt, updatedAt: record.updatedAt,
    };
  }

  private toSpecGroupResponse(sg: SpecGroupRecord): SpecGroupResponseDto {
    return {
      id: sg.id, shopId: sg.shopId, name: sg.name,
      isRequired: sg.isRequired, maxSelect: sg.maxSelect,
      options: sg.options,
      createdAt: sg.createdAt, updatedAt: sg.updatedAt,
    };
  }
}
