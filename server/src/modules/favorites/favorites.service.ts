import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { supabase, hasSupabase } from '../../database/supabase.client';

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

// 内存存储（使用模块级别变量）
const memoryFavorites: Map<string, Favorite> = new Map(); // key: `${userId}:${menuItemId}`

@Injectable()
export class FavoritesService {
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
          console.warn('[Favorites] Supabase 查询失败，使用内存模式:', error.message);
        } else {
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
        console.warn('[Favorites] Supabase 查询异常，使用内存模式:', e);
      }
    }

    // 内存模式
    const userFavorites = Array.from(memoryFavorites.values())
      .filter(f => f.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return userFavorites.map(f => ({
      ...f,
      menuItem: {
        id: f.menuItemId,
        name: '菜品',
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

  async addFavorite(userId: string, menuItemId: string, shopId: string): Promise<Favorite> {
    if (hasSupabase() && supabase) {
      const { data: existing } = await supabase
        .from('tf_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('menu_item_id', menuItemId)
        .single();

      if (existing) {
        throw new BadRequestException('已收藏该菜品');
      }

      const { data, error } = await supabase
        .from('tf_favorites')
        .insert({
          user_id: userId,
          menu_item_id: menuItemId,
          shop_id: shopId,
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestException(`收藏失败: ${error.message}`);
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
