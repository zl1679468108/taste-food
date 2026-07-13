import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';

export interface Favorite {
  id: string;
  userId: string;
  menuItemId: string;
  shopId: string;
  createdAt: string;
}

export interface FavoriteWithMenuItem extends Favorite {
  menuItem: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    description: string;
  };
}

// 内存存储（使用模块级别变量，仅开发环境）
const memoryFavorites: Map<string, Favorite> = new Map(); // key: `${userId}:${menuItemId}`
const memoryMenuItemsCache: Map<string, { id: string; name: string; price: number; imageUrl: string; description: string; }> = new Map();

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  async findByUserId(userId: string): Promise<FavoriteWithMenuItem[]> {
    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_favorites')
          .select(`
            *,
            tf_menu_items!inner(id, name, price, image_url, description)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          this.logger.warn('[Favorites] Supabase 查询失败，使用内存模式:', error.message);
        } else {
          // 缓存菜品信息供内存模式使用
          (data || []).forEach((item: any) => {
            if (item.tf_menu_items) {
              memoryMenuItemsCache.set(item.menu_item_id, {
                id: item.tf_menu_items.id,
                name: item.tf_menu_items.name,
                price: item.tf_menu_items.price,
                imageUrl: item.tf_menu_items.image_url || '',
                description: item.tf_menu_items.description || '',
              });
            }
          });
          return (data || []).map((item: any) => ({
            id: item.id,
            userId: item.user_id,
            menuItemId: item.menu_item_id,
            shopId: item.shop_id,
            createdAt: item.created_at,
            menuItem: {
              id: item.tf_menu_items.id,
              name: item.tf_menu_items.name,
              price: item.tf_menu_items.price,
              imageUrl: item.tf_menu_items.image_url || '',
              description: item.tf_menu_items.description || '',
            },
          }));
        }
      } catch (e) {
        this.logger.warn('[Favorites] Supabase 查询异常，使用内存模式:', e);
      }
    }

    assertMemoryFallbackAllowed('FavoritesService');
    // 内存模式：从缓存获取菜品信息，无缓存则标记为已删除
    const userFavorites = Array.from(memoryFavorites.values())
      .filter(f => f.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return userFavorites.map(f => ({
      ...f,
      menuItem: memoryMenuItemsCache.get(f.menuItemId) || {
        id: f.menuItemId,
        name: '已删除菜品',
        price: 0,
        imageUrl: '',
        description: '',
      },
    }));
  }

  async checkFavorite(userId: string, menuItemId: string): Promise<boolean> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('menu_item_id', menuItemId)
        .single();

      return !error && !!data;
    }

    // 内存模式
    const key = `${userId}:${menuItemId}`;
    return memoryFavorites.has(key);
  }

  /**
   * 批量查询用户收藏的 menuItemId 集合（避免逐菜品 N+1 查询）
   * 返回 Set 供调用方做内存判断
   */
  async batchCheckFavorites(userId: string, menuItemIds: string[]): Promise<Set<string>> {
    const result = new Set<string>();
    if (menuItemIds.length === 0) return result;

    if (hasSupabase() && supabase) {
      try {
        const { data, error } = await supabase
          .from('tf_favorites')
          .select('menu_item_id')
          .eq('user_id', userId)
          .in('menu_item_id', menuItemIds);
        if (!error && data) {
          for (const row of data) {
            result.add(row.menu_item_id);
          }
        }
      } catch (e) {
        this.logger.warn('[Favorites] 批量查询收藏失败:', e);
      }
      return result;
    }

    // 内存模式
    for (const id of menuItemIds) {
      if (memoryFavorites.has(`${userId}:${id}`)) {
        result.add(id);
      }
    }
    return result;
  }

  async addFavorite(userId: string, menuItemId: string, shopId: string): Promise<Favorite> {
    if (hasSupabase() && supabase) {
      // 使用 upsert 原子化插入：基于 (user_id, menu_item_id) 唯一约束，
      // 冲突时忽略（ignoreDuplicates），避免 check-then-add 的并发竞态
      const { data, error } = await supabase
        .from('tf_favorites')
        .upsert({
          user_id: userId,
          menu_item_id: menuItemId,
          shop_id: shopId,
        }, {
          onConflict: 'user_id,menu_item_id',
          ignoreDuplicates: true,
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestException(`收藏失败: ${error.message}`);
      }

      // ignoreDuplicates=true 时，若记录已存在则 data 为 null
      if (!data) {
        throw new BadRequestException('已收藏该菜品');
      }

      return {
        id: data.id,
        userId: data.user_id,
        menuItemId: data.menu_item_id,
        shopId: data.shop_id,
        createdAt: data.created_at,
      };
    }

    // 内存模式
    const key = `${userId}:${menuItemId}`;
    if (memoryFavorites.has(key)) {
      throw new BadRequestException('已收藏该菜品');
    }

    const favorite: Favorite = {
      id: uuidv4(),
      userId,
      menuItemId,
      shopId,
      createdAt: new Date().toISOString(),
    };
    memoryFavorites.set(key, favorite);
    return favorite;
  }

  async removeFavorite(userId: string, menuItemId: string): Promise<void> {
    if (hasSupabase() && supabase) {
      const { error } = await supabase
        .from('tf_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('menu_item_id', menuItemId);

      if (error) {
        throw new BadRequestException(`取消收藏失败: ${error.message}`);
      }
      return;
    }

    // 内存模式
    const key = `${userId}:${menuItemId}`;
    memoryFavorites.delete(key);
  }

  async toggleFavorite(userId: string, menuItemId: string, shopId: string): Promise<{ isFavorite: boolean }> {
    const isFavorite = await this.checkFavorite(userId, menuItemId);
    
    if (isFavorite) {
      await this.removeFavorite(userId, menuItemId);
      return { isFavorite: false };
    } else {
      await this.addFavorite(userId, menuItemId, shopId);
      return { isFavorite: true };
    }
  }
}
