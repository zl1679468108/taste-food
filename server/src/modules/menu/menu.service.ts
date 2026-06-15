import { Injectable, NotFoundException } from '@nestjs/common';
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

interface CategoryRecord {
  id: string;
  shopId: string;
  name: string;
  sortOrder: number;
  iconKey: string;
  createdAt: string;
  updatedAt: string;
}

interface MenuItemRecord {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  price: number;
  imageUrl: string;
  description: string;
  status: MenuItemStatus;
  salesCount: number;
  specGroupIds: string[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MenuService {
  private categories: Map<string, CategoryRecord> = new Map();
  private menuItems: Map<string, MenuItemRecord> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData(): void {
    const shopId = '00000000-0000-0000-0000-000000000001';
    const now = '2025-06-15T00:00:00Z';

    // 分类
    const categories = [
      { id: uuidv4(), shopId, name: '招牌推荐', sortOrder: 0, iconKey: 'star' },
      { id: uuidv4(), shopId, name: '烤肉类', sortOrder: 1, iconKey: 'meat' },
      { id: uuidv4(), shopId, name: '素菜类', sortOrder: 2, iconKey: 'vegetable' },
      { id: uuidv4(), shopId, name: '酒水类', sortOrder: 3, iconKey: 'drink' },
      { id: uuidv4(), shopId, name: '主食类', sortOrder: 4, iconKey: 'rice' },
    ];

    for (const cat of categories) {
      this.categories.set(cat.id, { ...cat, createdAt: now, updatedAt: now });
    }

    const catIds = categories.map((c) => c.id);

    // 菜品
    const menuItems: Partial<MenuItemRecord>[] = [
      { categoryId: catIds[0], name: '秘制烤羊排', price: 6800, description: '精选内蒙古羊排，秘制配方腌制', salesCount: 188, imageUrl: '' },
      { categoryId: catIds[0], name: '招牌烤鸡翅', price: 1800, description: '奥尔良风味，外焦里嫩', salesCount: 256, imageUrl: '' },
      { categoryId: catIds[1], name: '炭烤牛肉串', price: 3000, description: '新鲜牛肉，炭火慢烤', salesCount: 320, imageUrl: '' },
      { categoryId: catIds[1], name: '香辣羊肉串', price: 2500, description: '孜然香辣，回味无穷', salesCount: 280, imageUrl: '' },
      { categoryId: catIds[1], name: '蜜汁烤排骨', price: 3500, description: '蜜汁腌制，甜香可口', salesCount: 156, imageUrl: '' },
      { categoryId: catIds[2], name: '烤茄子', price: 800, description: '蒜蓉烤茄子，软糯入味', salesCount: 198, imageUrl: '' },
      { categoryId: catIds[2], name: '烤金针菇', price: 600, description: '锡纸金针菇，鲜嫩多汁', salesCount: 175, imageUrl: '' },
      { categoryId: catIds[2], name: '烤韭菜', price: 500, description: '新鲜韭菜，烧烤经典', salesCount: 143, imageUrl: '' },
      { categoryId: catIds[3], name: '可乐', price: 500, description: '冰镇可口可乐', salesCount: 400, imageUrl: '' },
      { categoryId: catIds[3], name: '啤酒', price: 800, description: '冰镇青岛啤酒', salesCount: 350, imageUrl: '' },
      { categoryId: catIds[3], name: '矿泉水', price: 300, description: '农夫山泉', salesCount: 200, imageUrl: '' },
      { categoryId: catIds[4], name: '烤冷面', price: 1000, description: '东北烤冷面，酸甜可口', salesCount: 120, imageUrl: '' },
      { categoryId: catIds[4], name: '烤馒头片', price: 400, description: '炭烤馒头片，外酥里软', salesCount: 90, imageUrl: '' },
    ];

    for (const item of menuItems) {
      const id = uuidv4();
      this.menuItems.set(id, {
        id,
        shopId,
        categoryId: item.categoryId!,
        name: item.name!,
        price: item.price!,
        imageUrl: item.imageUrl || '',
        description: item.description || '',
        status: MenuItemStatus.ACTIVE,
        salesCount: item.salesCount || 0,
        specGroupIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // === 分类操作 ===

  async getCategories(shopId: string): Promise<CategoryResponseDto[]> {
    const result = Array.from(this.categories.values())
      .filter((c) => c.shopId === shopId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return result.map(this.toCategoryResponse);
  }

  async createCategory(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const now = new Date().toISOString();
    const category: CategoryRecord = {
      id: uuidv4(),
      shopId: dto.shopId,
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
      iconKey: dto.iconKey || '',
      createdAt: now,
      updatedAt: now,
    };
    this.categories.set(category.id, category);
    return this.toCategoryResponse(category);
  }

  // === 菜品操作 ===

  async getMenuItems(
    shopId: string,
    categoryId?: string,
  ): Promise<MenuItemResponseDto[]> {
    let result = Array.from(this.menuItems.values()).filter(
      (item) => item.shopId === shopId,
    );

    if (categoryId) {
      result = result.filter((item) => item.categoryId === categoryId);
    }

    return result.map(this.toMenuItemResponse);
  }

  async getMenuItemById(id: string): Promise<MenuItemResponseDto> {
    const item = this.menuItems.get(id);
    if (!item) {
      throw new NotFoundException(`菜品 ${id} 不存在`);
    }
    return this.toMenuItemResponse(item);
  }

  async createMenuItem(dto: CreateMenuItemDto): Promise<MenuItemResponseDto> {
    const now = new Date().toISOString();
    const menuItem: MenuItemRecord = {
      id: uuidv4(),
      shopId: dto.shopId,
      categoryId: dto.categoryId,
      name: dto.name,
      price: dto.price,
      imageUrl: dto.imageUrl || '',
      description: dto.description || '',
      status: (dto.status as MenuItemStatus) || MenuItemStatus.ACTIVE,
      salesCount: dto.salesCount || 0,
      specGroupIds: dto.specGroupIds || [],
      createdAt: now,
      updatedAt: now,
    };
    this.menuItems.set(menuItem.id, menuItem);
    return this.toMenuItemResponse(menuItem);
  }

  async updateCategory(
    id: string,
    dto: Partial<CreateCategoryDto>,
  ): Promise<CategoryResponseDto> {
    const category = this.categories.get(id);
    if (!category) {
      throw new NotFoundException(`分类 ${id} 不存在`);
    }

    const updated: CategoryRecord = {
      ...category,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.iconKey !== undefined && { iconKey: dto.iconKey }),
      updatedAt: new Date().toISOString(),
    };
    this.categories.set(id, updated);
    return this.toCategoryResponse(updated);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = this.categories.get(id);
    if (!category) {
      throw new NotFoundException(`分类 ${id} 不存在`);
    }
    // 同时删除该分类下的所有菜品
    for (const [itemId, item] of this.menuItems.entries()) {
      if (item.categoryId === id) {
        this.menuItems.delete(itemId);
      }
    }
    this.categories.delete(id);
  }

  async updateMenuItem(
    id: string,
    dto: Partial<CreateMenuItemDto>,
  ): Promise<MenuItemResponseDto> {
    const menuItem = this.menuItems.get(id);
    if (!menuItem) {
      throw new NotFoundException(`菜品 ${id} 不存在`);
    }

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
    this.menuItems.set(id, updated);
    return this.toMenuItemResponse(updated);
  }

  async deleteMenuItem(id: string): Promise<void> {
    const menuItem = this.menuItems.get(id);
    if (!menuItem) {
      throw new NotFoundException(`菜品 ${id} 不存在`);
    }
    this.menuItems.delete(id);
  }

  private toCategoryResponse(record: CategoryRecord): CategoryResponseDto {
    return {
      id: record.id,
      shopId: record.shopId,
      name: record.name,
      sortOrder: record.sortOrder,
      iconKey: record.iconKey || undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toMenuItemResponse(record: MenuItemRecord): MenuItemResponseDto {
    return {
      id: record.id,
      shopId: record.shopId,
      categoryId: record.categoryId,
      name: record.name,
      price: record.price,
      imageUrl: record.imageUrl || undefined,
      description: record.description || undefined,
      status: record.status,
      salesCount: record.salesCount,
      specGroupIds:
        record.specGroupIds.length > 0 ? record.specGroupIds : undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
