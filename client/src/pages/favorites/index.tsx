import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, del, isRetryableError } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { DEFAULT_SHOP_ID } from '../../env';
import { formatPriceWithSymbol } from '../../utils/format';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import './index.scss';

interface FavoriteMenuItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  description?: string;
}

interface FavoriteItem {
  id: string;
  menuItemId: string;
  shopId: string;
  createdAt: string;
  menuItem: FavoriteMenuItem;
}

export default function FavoritesPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const addItem = useCartStore((s) => s.addItem);
  const setShopId = useCartStore((s) => s.setShopId);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    if (!useAuthStore.getState().isLoggedIn) {
      setFavorites([]);
      setLoading(false);
      setLoadError(false);
      return;
    }

    setLoading(true);
    setLoadError(false);
    setCanRetry(false);
    try {
      const res = await get<FavoriteItem[]>('/favorites', undefined, { useCache: false });
      setFavorites(res.data || []);
      setLoadError(false);
      setCanRetry(false);
    } catch (error) {
      console.error('加载收藏失败:', error);
      setLoadError(true);
      setCanRetry(isRetryableError(error));
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites, isLoggedIn]);

  Taro.usePullDownRefresh(() => {
    loadFavorites().finally(() => {
      Taro.stopPullDownRefresh();
    });
  });

  const handleRemove = async (item: FavoriteItem) => {
    try {
      await del(`/favorites/${item.menuItemId}`);
      setFavorites((prev) => prev.filter((f) => f.menuItemId !== item.menuItemId));
      Taro.showToast({ title: '已取消收藏', icon: 'success' });
    } catch (error) {
      console.error('取消收藏失败:', error);
      Taro.showToast({ title: '取消收藏失败', icon: 'none' });
    }
  };

  const handleAddToCart = (item: FavoriteItem) => {
    const menu = item.menuItem;
    if (!menu?.id || !menu.name || menu.price == null) {
      Taro.showToast({ title: '菜品已下架', icon: 'none' });
      return;
    }
    if (addingId) return;
    setAddingId(item.menuItemId);
    try {
      setShopId(item.shopId || DEFAULT_SHOP_ID);
      addItem({
        menuItemId: menu.id || item.menuItemId,
        name: menu.name,
        price: menu.price,
        quantity: 1,
        specDesc: '',
        imageUrl: menu.imageUrl || '',
      });
      Taro.showToast({ title: '已加入购物车', icon: 'success' });
    } catch (error) {
      console.error('加购失败:', error);
      Taro.showToast({ title: '加购失败', icon: 'none' });
    } finally {
      setAddingId(null);
    }
  };

  if (loading) {
    return (
      <View className='favorites-page'>
        <SkeletonLoader mode='list' count={4} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View className='favorites-page'>
        <EmptyState
          icon='🔒'
          title='请先登录'
          description='登录后可查看收藏菜品'
          actionText='去登录'
          onAction={() => Taro.navigateTo({ url: '/pages/auth/login' })}
        />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className='favorites-page'>
        <EmptyState
          icon='⚠️'
          title='加载失败'
          description={canRetry ? '网络不稳定，请重试' : '收藏列表暂时无法获取'}
          actionText={canRetry ? '点击重试' : '重新加载'}
          onAction={loadFavorites}
        />
      </View>
    );
  }

  if (favorites.length === 0) {
    return (
      <View className='favorites-page'>
        <EmptyState
          icon='🤍'
          title='还没有收藏'
          description='去菜单里点亮心形收藏喜欢的菜品吧'
          actionText='去点餐'
          onAction={() => Taro.switchTab({ url: '/pages/menu/index' })}
        />
      </View>
    );
  }

  return (
    <View className='favorites-page'>
      <View className='favorites-page__list'>
        {favorites.map((item) => {
          const available = !!(item.menuItem?.name && item.menuItem?.price != null);
          return (
            <View
              key={item.id || item.menuItemId}
              className='favorite-card'
              aria-label={`收藏菜品 ${item.menuItem?.name || ''}`}
            >
              <View className='favorite-card__image'>
                {item.menuItem?.imageUrl ? (
                  <Image
                    className='favorite-card__img'
                    src={item.menuItem.imageUrl}
                    mode='aspectFill'
                    lazyLoad
                    aria-label={item.menuItem.name}
                  />
                ) : (
                  <Text>🍽️</Text>
                )}
              </View>
              <View className='favorite-card__info'>
                <View>
                  <Text className='favorite-card__name'>{item.menuItem?.name || '菜品已下架'}</Text>
                  {item.menuItem?.description ? (
                    <Text className='favorite-card__desc'>{item.menuItem.description}</Text>
                  ) : null}
                </View>
                <View className='favorite-card__bottom'>
                  <Text className='favorite-card__price'>
                    {item.menuItem?.price != null ? formatPriceWithSymbol(item.menuItem.price) : '-'}
                  </Text>
                  <View className='favorite-card__actions'>
                    <View
                      className={`favorite-card__add${available ? '' : ' favorite-card__add--disabled'}`}
                      onClick={() => available && handleAddToCart(item)}
                      aria-label={`加入购物车 ${item.menuItem?.name || ''}`}
                    >
                      {addingId === item.menuItemId ? '加入中' : '加购'}
                    </View>
                    <View
                      className='favorite-card__remove'
                      onClick={() => handleRemove(item)}
                      aria-label={`取消收藏 ${item.menuItem?.name || ''}`}
                    >
                      取消
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
      <View
        className='favorites-page__cta'
        onClick={() => Taro.switchTab({ url: '/pages/menu/index' })}
        aria-label='去点餐'
      >
        <Text>去点餐</Text>
      </View>
    </View>
  );
}
