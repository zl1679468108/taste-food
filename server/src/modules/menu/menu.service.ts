import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
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
import {
  SpecGroupResponseDto,
  SpecOptionResponseDto,
  CreateSpecGroupDto,
  SpecGroupOptionInputDto,
} from './dto/spec.dto';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { FavoritesService } from '../favorites/favorites.service';

const MENU_ITEM_SELECT =
  'id, category_id, shop_id, name, description, price, image_url, status, monthly_sales, spec_group_ids, created_at, updated_at';

async function queryMenuItems(
  build: (select: string) => any,
): Promise<{ data: any[] | any | null; error: any | null }> {
  return build(MENU_ITEM_SELECT);
}

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
  /** 列表/详情一次返回的规格明细（可选） */
  specs?: SpecGroupResponseDto[];
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

/** 需要做多租户归属校验的菜单资源表 */
type ShopOwnedTable = 'tf_categories' | 'tf_menu_items' | 'tf_spec_groups';

const SHOP_OWNED_TABLE_LABELS: Record<ShopOwnedTable, string> = {
  tf_categories: '分类',
  tf_menu_items: '菜品',
  tf_spec_groups: '规格组',
};

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

  private getMemoryOwner(table: ShopOwnedTable, id: string): { shopId: string } | undefined {
    switch (table) {
      case 'tf_categories':
        return memoryCategories.get(id);
      case 'tf_menu_items':
        return memoryMenuItems.get(id);
      case 'tf_spec_groups':
        return memorySpecGroups.get(id);
    }
  }

  /**
   * 多租户归属校验：确认资源属于目标店铺，否则抛 403。
   * shopId 为空表示平台管理员未指定目标店（跨店操作语义），跳过校验。
   * service 层兜底，避免仅依赖 controller 校验被其他调用方绕过。
   */
  private async assertShopOwnership(
    table: ShopOwnedTable,
    id: string,
    shopId?: string,
  ): Promise<void> {
    if (!shopId) return;
    const label = SHOP_OWNED_TABLE_LABELS[table];

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from(table)
        .select('id, shop_id')
        .eq('id', id)
        .single();
      if (error || !data) throw new NotFoundException(`${label} ${id} 不存在`);
      if ((data as { shop_id: string }).shop_id !== shopId) {
        throw new ForbiddenException(`无权操作其他店铺的${label}`);
      }
      return;
    }

    const record = this.getMemoryOwner(table, id);
    if (!record) throw new NotFoundException(`${label} ${id} 不存在`);
    if (record.shopId !== shopId) {
      throw new ForbiddenException(`无权操作其他店铺的${label}`);
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
      // 旧库可能缺少 monthly_sales/spec_group_ids：兼容查询后在内存排序
      const { data, error } = await queryMenuItems((select) => {
        let query = supabase!.from('tf_menu_items').select(select).eq('status', MenuItemStatus.ACTIVE);
        if (shopId) query = query.eq('shop_id', shopId);
        return query.limit(Math.max(limit * 5, 50));
      });
      if (error) throw new BadRequestException(`获取热门菜品失败: ${error.message}`);
      const items = (data || [])
        .map((row: any) => this.toMenuItem(row))
        .sort((a: any, b: any) => b.salesCount - a.salesCount)
        .slice(0, limit);
      // 批量查询收藏状态，避免逐菜品 N+1 查询
      const favoriteSet = userId
        ? await this.favoritesService.batchCheckFavorites(userId, items.map((i: any) => i.id))
        : undefined;
      const withSpecs = await this.attachSpecsToItems(items);
      return await Promise.all(withSpecs.map((i: any) => this.toMenuItemResponse(i, userId, favoriteSet)));
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
    const withSpecs = await this.attachSpecsToItems(sliced);
    return await Promise.all(withSpecs.map((i) => this.toMenuItemResponse(i, userId, favoriteSet)));
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
      const { data, error } = await queryMenuItems((select) => {
        let query = supabase!.from('tf_menu_items').select(select).eq('shop_id', sid).order('id');
        if (categoryId) query = query.eq('category_id', categoryId);
        // 转义 PostgreSQL LIKE/ILIKE 通配符（%、_、\），避免用户输入破坏查询模式
        if (search) {
          const escaped = search.split('\\').join('\\\\').split('%').join('\\%').split('_').join('\\_');
          query = query.ilike('name', `%${escaped}%`);
        }
        return query;
      });
      if (error) throw new BadRequestException(`获取菜品失败: ${error.message}`);
      const items = (data || []).map((row: any) => this.toMenuItem(row));
      // 批量查询收藏状态，避免逐菜品 N+1 查询
      const favoriteSet = userId
        ? await this.favoritesService.batchCheckFavorites(userId, items.map((i: any) => i.id))
        : undefined;
      const withSpecs = await this.attachSpecsToItems(items);
      return await Promise.all(withSpecs.map((i: any) => this.toMenuItemResponse(i, userId, favoriteSet)));
    }

    await this.seedIfEmpty();
    let items = Array.from(memoryMenuItems.values()).filter((i) => i.shopId === sid);
    if (categoryId) items = items.filter((i) => i.categoryId === categoryId);
    if (search) items = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    // 内存模式：直接用本地 Set 批量判断
    const favoriteSet = userId
      ? new Set(items.filter((i) => memoryFavorites.has(`${userId}:${i.id}`)).map((i) => i.id))
      : undefined;
    const withSpecs = await this.attachSpecsToItems(items);
    return await Promise.all(withSpecs.map((i: any) => this.toMenuItemResponse(i, userId, favoriteSet)));
  }

  async getMenuItemById(id: string, userId?: string): Promise<MenuItemResponseDto> {
    if (hasSupabase() && supabase) {
      const { data, error } = await queryMenuItems((select) =>
        supabase!.from('tf_menu_items').select(select).eq('id', id).single(),
      );
      if (error || !data) throw new NotFoundException(`菜品 ${id} 不存在`);
      const [withSpecs] = await this.attachSpecsToItems([this.toMenuItem(data)]);
      return await this.toMenuItemResponse(withSpecs, userId);
    }

    const item = memoryMenuItems.get(id);
    if (!item) throw new NotFoundException(`菜品 ${id} 不存在`);
    const [withSpecs] = await this.attachSpecsToItems([item]);
    return await this.toMenuItemResponse(withSpecs, userId);
  }

  /**
   * 批量按 ID 查询菜品（用于订单创建等 N+1 热点路径）。
   * 返回的 Map 以传入 id 为 key；不存在的 id 不会出现在 Map 中。
   */
  async getMenuItemsByIds(ids: string[]): Promise<Map<string, MenuItemResponseDto>> {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return new Map();

    if (hasSupabase() && supabase) {
      const { data, error } = await queryMenuItems((select) =>
        supabase!.from('tf_menu_items').select(select).in('id', uniqueIds),
      );
      if (error) {
        this.logger.warn(`[Menu] 批量查询菜品失败: ${error.message}`);
        return new Map();
      }
      const items = (data || []).map((row: any) => this.toMenuItem(row));
      const withSpecs = await this.attachSpecsToItems(items);
      const result = new Map<string, MenuItemResponseDto>();
      for (const item of withSpecs) {
        const dto = await this.toMenuItemResponse(item);
        result.set(item.id, dto);
      }
      return result;
    }

    await this.seedIfEmpty();
    const result = new Map<string, MenuItemResponseDto>();
    for (const id of uniqueIds) {
      const item = memoryMenuItems.get(id);
      if (!item) continue;
      const [withSpecs] = await this.attachSpecsToItems([item]);
      result.set(id, await this.toMenuItemResponse(withSpecs));
    }
    return result;
  }

  /** 店铺级规格组列表（管理端绑定时下拉用） */
  async getShopSpecGroups(shopId?: string): Promise<SpecGroupResponseDto[]> {
    const sid = shopId || DEFAULT_SHOP_ID;
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_spec_groups')
        .select('*, tf_spec_options(*)')
        .eq('shop_id', sid)
        .order('created_at');
      if (error) throw new BadRequestException(`获取规格组失败: ${error.message}`);
      return (data || []).map((row: any) => {
        const options = (row.tf_spec_options || []).map((opt: any) => ({
          id: opt.id,
          specGroupId: opt.spec_group_id,
          name: opt.name,
          priceAdjust: opt.price_adjust || 0,
          isDefault: !!opt.is_default,
          createdAt: opt.created_at,
          updatedAt: opt.updated_at,
        }));
        return this.toSpecGroupResponse({
          id: row.id,
          shopId: row.shop_id,
          name: row.name,
          isRequired: row.is_required ?? false,
          maxSelect: row.max_select ?? 1,
          options,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      });
    }

    await this.seedIfEmpty();
    return Array.from(memorySpecGroups.values())
      .filter((sg) => sg.shopId === sid)
      .map((sg) => this.toSpecGroupResponse(sg));
  }

    async getMenuItemSpecs(menuItemId: string): Promise<SpecGroupResponseDto[]> {
    // 与详情一致：走 attachSpecs，保证选项结构正确
    const item = await this.getMenuItemById(menuItemId);
    return item.specs || [];
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
          spec_group_ids: dto.specGroupIds || [],
        })
        .select()
        .single();
      if (error) throw new BadRequestException(`创建菜品失败: ${error.message}`);
      const [withSpecs] = await this.attachSpecsToItems([this.toMenuItem(data)]);
      return await this.toMenuItemResponse(withSpecs);
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
    const [withSpecs] = await this.attachSpecsToItems([menuItem]);
    return await this.toMenuItemResponse(withSpecs);
  }

  async updateCategory(
    id: string,
    dto: Partial<CreateCategoryDto>,
    shopId?: string,
  ): Promise<CategoryResponseDto> {
    await this.assertShopOwnership('tf_categories', id, shopId);

    if (hasSupabase() && supabase) {
      let query = supabase
        .from('tf_categories')
        .update({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.sortOrder !== undefined && { sort_order: dto.sortOrder }),
          ...(dto.iconKey !== undefined && { icon_key: dto.iconKey }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      // 兜底：带上 shop_id 过滤，避免归属校验与写入之间的竞态
      if (shopId) query = query.eq('shop_id', shopId);
      const { data, error } = await query.select().single();
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

  async deleteCategory(id: string, shopId?: string): Promise<void> {
    // atomic_delete_category RPC 仅按 id 删除，无法带 shop_id 条件，
    // 因此必须在调用前完成归属校验
    await this.assertShopOwnership('tf_categories', id, shopId);

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
    shopId?: string,
  ): Promise<MenuItemResponseDto> {
    await this.assertShopOwnership('tf_menu_items', id, shopId);

    if (hasSupabase() && supabase) {
      let query = supabase
        .from('tf_menu_items')
        .update({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.categoryId !== undefined && { category_id: dto.categoryId }),
          ...(dto.imageUrl !== undefined && { image_url: dto.imageUrl }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.salesCount !== undefined && { monthly_sales: dto.salesCount }),
          ...(dto.specGroupIds !== undefined && { spec_group_ids: dto.specGroupIds }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      // 兜底：带上 shop_id 过滤，避免归属校验与写入之间的竞态
      if (shopId) query = query.eq('shop_id', shopId);
      const { data, error } = await query.select().single();
      if (error) throw new BadRequestException(`更新菜品失败: ${error.message}`);
      const [withSpecs] = await this.attachSpecsToItems([this.toMenuItem(data)]);
      return await this.toMenuItemResponse(withSpecs);
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
      ...(dto.specGroupIds !== undefined && { specGroupIds: dto.specGroupIds }),
      updatedAt: new Date().toISOString(),
    };
    memoryMenuItems.set(id, updated);
    const [withSpecs] = await this.attachSpecsToItems([updated]);
    return await this.toMenuItemResponse(withSpecs);
  }

  async deleteMenuItem(id: string, shopId?: string): Promise<void> {
    await this.assertShopOwnership('tf_menu_items', id, shopId);

    if (hasSupabase() && supabase) {
      let query = supabase
        .from('tf_menu_items')
        .delete()
        .eq('id', id);
      if (shopId) query = query.eq('shop_id', shopId);
      const { error } = await query;
      if (error) throw new BadRequestException(`删除菜品失败: ${error.message}`);
      return;
    }

    const menuItem = memoryMenuItems.get(id);
    if (!menuItem) throw new NotFoundException(`菜品 ${id} 不存在`);
    memoryMenuItems.delete(id);
  }

  /**
   * 批量上/下架菜品。
   * shopId 存在时只更新该店铺的菜品（跨店 id 直接被过滤，不会被修改）；
   * shopId 为空表示平台管理员未指定目标店，保留跨店操作语义。
   * @returns 实际更新成功的菜品数量
   */
  async batchUpdateMenuItemStatus(
    ids: string[],
    isAvailable: boolean,
    shopId?: string,
  ): Promise<number> {
    const status = isAvailable ? MenuItemStatus.ACTIVE : MenuItemStatus.INACTIVE;
    const now = new Date().toISOString();

    if (hasSupabase() && supabase) {
      let query = supabase
        .from('tf_menu_items')
        .update({ status, updated_at: now })
        .in('id', ids);
      // 多租户兜底：只允许操作目标店铺的菜品
      if (shopId) query = query.eq('shop_id', shopId);
      const { data, error } = await query.select('id');
      if (error) throw new BadRequestException(`批量更新菜品状态失败: ${error.message}`);
      return (data || []).length;
    }

    let updated = 0;
    for (const id of ids) {
      const item = memoryMenuItems.get(id);
      if (!item) continue;
      if (shopId && item.shopId !== shopId) continue;
      memoryMenuItems.set(id, { ...item, status, updatedAt: now });
      updated += 1;
    }
    return updated;
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


  /**
   * 批量加载菜品关联规格（去重后一次查库），挂到 items 上
   * 小店菜单体量小，列表一次返回规格，避免加购再打 /specs
   */
  private async attachSpecsToItems(items: MenuItemRecord[]): Promise<MenuItemRecord[]> {
    if (!items.length) return items;

    const allIds = Array.from(
      new Set(items.flatMap((item) => item.specGroupIds || [])),
    );
    if (allIds.length === 0) {
      return items.map((item) => ({ ...item, specs: [] }));
    }

    const groupMap = new Map<string, SpecGroupResponseDto>();

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_spec_groups')
        .select('*, tf_spec_options(*)')
        .in('id', allIds);
      if (error) {
        this.logger.warn(`[Menu] 批量加载规格失败: ${error.message}`);
      } else {
        for (const row of data || []) {
          // Supabase 联表返回 tf_spec_options 数组，转成内部 SpecGroupRecord 结构
          const options = ((row as any).tf_spec_options || []).map((opt: any) => ({
            id: opt.id,
            specGroupId: opt.spec_group_id,
            name: opt.name,
            priceAdjust: opt.price_adjust || 0,
            isDefault: !!opt.is_default,
            createdAt: opt.created_at,
            updatedAt: opt.updated_at,
          }));
          const sg: SpecGroupRecord = {
            id: row.id,
            shopId: row.shop_id,
            name: row.name,
            isRequired: row.is_required ?? false,
            maxSelect: row.max_select ?? 1,
            options,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
          groupMap.set(sg.id, this.toSpecGroupResponse(sg));
        }
      }
    } else {
      for (const id of allIds) {
        const mem = memorySpecGroups.get(id);
        if (mem) groupMap.set(id, this.toSpecGroupResponse(mem));
      }
    }

    return items.map((item) => ({
      ...item,
      specs: (item.specGroupIds || [])
        .map((id) => groupMap.get(id))
        .filter(Boolean) as SpecGroupResponseDto[],
    }));
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
      // 始终返回数组：前端可据此判断“已解析过规格”，无需再打 /specs
      specs: Array.isArray(record.specs)
        ? record.specs
        : (record.specGroupIds.length > 0
          ? record.specGroupIds
              .map((sgId) => {
                const mem = memorySpecGroups.get(sgId);
                return mem ? this.toSpecGroupResponse(mem) : null;
              })
              .filter(Boolean) as SpecGroupResponseDto[]
          : []),
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
  /**
   * 按「全量替换」语义重写某个规格组的选项：
   * 传入列表中带 id 的视为保留更新，未出现的旧选项删除，无 id 的新增。
   * 调用方需自行保证 groupId 的店铺归属已校验。
   */
  private async replaceSpecOptions(
    groupId: string,
    options: SpecGroupOptionInputDto[],
  ): Promise<SpecOptionResponseDto[]> {
    const now = new Date().toISOString();
    // 归一化：过滤空名称，价格修正取整（金额单位为分，不接受小数）
    const normalized = options
      .map((opt) => ({
        id: opt.id,
        name: (opt.name || '').trim(),
        priceAdjust: Math.round(Number(opt.priceAdjust) || 0),
        isDefault: !!opt.isDefault,
      }))
      .filter((opt) => opt.name.length > 0);

    if (hasSupabase() && supabase) {
      const keepIds = normalized.map((o) => o.id).filter(Boolean) as string[];

      // 1. 删除本次未出现的旧选项
      let delQuery = supabase.from('tf_spec_options').delete().eq('spec_group_id', groupId);
      if (keepIds.length > 0) {
        delQuery = delQuery.not('id', 'in', `(${keepIds.join(',')})`);
      }
      const { error: delError } = await delQuery;
      if (delError) throw new BadRequestException(`更新规格选项失败: ${delError.message}`);

      if (normalized.length === 0) return [];

      // 2. upsert 保留项与新增项
      const rows = normalized.map((opt) => ({
        id: opt.id || uuidv4(),
        spec_group_id: groupId,
        name: opt.name,
        price_adjust: opt.priceAdjust,
        is_default: opt.isDefault,
        updated_at: now,
      }));
      const { data, error } = await supabase
        .from('tf_spec_options')
        .upsert(rows, { onConflict: 'id' })
        .select();
      if (error) throw new BadRequestException(`保存规格选项失败: ${error.message}`);

      return (data || []).map((opt: any) => ({
        id: opt.id,
        specGroupId: opt.spec_group_id,
        name: opt.name,
        priceAdjust: opt.price_adjust || 0,
        isDefault: !!opt.is_default,
        createdAt: opt.created_at,
        updatedAt: opt.updated_at,
      }));
    }

    // 内存兜底
    return normalized.map((opt) => ({
      id: opt.id || uuidv4(),
      specGroupId: groupId,
      name: opt.name,
      priceAdjust: opt.priceAdjust,
      isDefault: opt.isDefault,
      createdAt: now,
      updatedAt: now,
    }));
  }

  async createSpecGroup(dto: CreateSpecGroupDto): Promise<SpecGroupResponseDto> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_spec_groups')
        .insert({
          id: uuidv4(),
          shop_id: dto.shopId,
          name: dto.name,
          is_required: dto.isRequired ?? true,
          max_select: dto.maxSelect || 1,
        })
        .select()
        .single();

      if (error) throw new BadRequestException(`创建规格组失败: ${error.message}`);

      // 选项随规格组一并落库，避免出现「有规格组但无可选项」的空壳数据
      const options = dto.options?.length
        ? await this.replaceSpecOptions(data.id, dto.options)
        : [];
      return { ...this.toSpecGroupResponse(data), options };
    }

    const id = uuidv4();
    const record: SpecGroupRecord = {
      id,
      shopId: dto.shopId,
      name: dto.name,
      isRequired: dto.isRequired ?? true,
      maxSelect: dto.maxSelect || 1,
      options: dto.options?.length ? await this.replaceSpecOptions(id, dto.options) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memorySpecGroups.set(id, record);
    return this.toSpecGroupResponse(record);
  }

  async updateSpecGroup(
    id: string,
    dto: Partial<CreateSpecGroupDto>,
    shopId?: string,
  ): Promise<SpecGroupResponseDto> {
    await this.assertShopOwnership('tf_spec_groups', id, shopId);

    if (hasSupabase() && supabase) {
      let query = supabase
        .from('tf_spec_groups')
        .update({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.isRequired !== undefined && { is_required: dto.isRequired }),
          ...(dto.maxSelect !== undefined && { max_select: dto.maxSelect }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      // 兜底：带上 shop_id 过滤，避免归属校验与写入之间的竞态
      if (shopId) query = query.eq('shop_id', shopId);
      const { data, error } = await query.select().single();

      if (error) throw new BadRequestException(`更新规格组失败: ${error.message}`);

      const base = this.toSpecGroupResponse(data);
      // options 为 undefined 表示本次不改动选项；传空数组则表示清空
      if (dto.options === undefined) return base;
      return { ...base, options: await this.replaceSpecOptions(id, dto.options) };
    }

    const existing = memorySpecGroups.get(id);
    if (!existing) throw new NotFoundException(`规格组不存在`);
    const updated: SpecGroupRecord = {
      ...existing,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
      ...(dto.maxSelect !== undefined && { maxSelect: dto.maxSelect }),
      ...(dto.options !== undefined && {
        options: await this.replaceSpecOptions(id, dto.options),
      }),
      updatedAt: new Date().toISOString(),
    };
    memorySpecGroups.set(id, updated);
    return this.toSpecGroupResponse(updated);
  }

  async deleteSpecGroup(id: string, shopId?: string): Promise<void> {
    await this.assertShopOwnership('tf_spec_groups', id, shopId);

    if (hasSupabase() && supabase) {
      let query = supabase.from('tf_spec_groups').delete().eq('id', id);
      if (shopId) query = query.eq('shop_id', shopId);
      const { error } = await query;
      if (error) throw new BadRequestException(`删除规格组失败: ${error.message}`);
      return;
    }

    if (memorySpecGroups.has(id)) {
      memorySpecGroups.delete(id);
    }
  }
}
