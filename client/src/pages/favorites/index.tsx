import { useCallback, useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, del, isRetryableError, isDuplicateSubmitError } from '../../utils/request';
import { useKeyedAsyncAction } from '../../hooks/useAsyncAction';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { DEFAULT_SHOP_ID } from '../../env';
import { formatPriceWithSymbol } from '../../utils/format';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import FoodThumb from '../../components/FoodThumb';
import Icon from '../../components/Icon';
import ListEndTip from '../../components/ListEndTip';
import FooterBar from '../../components/FooterBar';
import './index.scss';

interface FavoriteMenuItem {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  description?: string;
  salesCount?: number;
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
  const { isPending: isRowPending, run: runRowAction } = useKeyedAsyncAction();

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

  const handleRemove = (item: FavoriteItem) => {
    void runRowAction(`fav:${item.menuItemId}`, async () => {
      try {
        await del(`/favorites/${item.menuItemId}`);
        setFavorites((prev) => prev.filter((f) => f.menuItemId !== item.menuItemId));
        Taro.showToast({ title: '已取消收藏', icon: 'success' });
      } catch (error) {
        if (isDuplicateSubmitError(error)) return;
        console.error('取消收藏失败:', error);
        Taro.showToast({ title: '取消收藏失败', icon: 'none' });
      }
    });
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
      if (isDuplicateSubmitError(error)) {
        setAddingId(null);
        return;
      }
      console.error('加购失败:', error);
      Taro.showToast({ title: '加购失败', icon: 'none' });
    } finally {
      setAddingId(null);
    }
  };

  const goMenu = () => Taro.switchTab({ url: '/pages/menu/index' });
  const goLogin = () => Taro.navigateTo({ url: '/pages/auth/login' });

  if (loading) {
    return (
      <View className='favorites-page'>
        <SkeletonLoader mode='favorites' count={4} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View className='favorites-page'>
        <EmptyState
          icon='lock'
          title='请先登录'
          description='登录后就能查看收藏的菜'
        />
        <FooterBar actionOnly actionText='去登录' onAction={goLogin} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className='favorites-page'>
        <EmptyState
          icon='warning'
          title='加载失败'
          description={canRetry ? '网络不太稳，点一下再试试' : '收藏暂时加载不出来'}
        />
        <FooterBar
          actionOnly
          actionText={canRetry ? '再试一次' : '重新加载'}
          onAction={loadFavorites}
        />
      </View>
    );
  }

  if (favorites.length === 0) {
    return (
      <View className='favorites-page'>
        <EmptyState
          icon='heart'
          title='还没有收藏'
          description='在菜单里点亮心形，收藏常点的菜'
        />
        <FooterBar actionOnly actionText='去点餐' onAction={goMenu} />
      </View>
    );
  }

  return (
    <View className='favorites-page'>
      <View className='favorites-page__list'>
        {favorites.map((item) => {
          const available = !!(item.menuItem?.name && item.menuItem?.price != null);
          const name = item.menuItem?.name || '菜品已下架';
          const priceText =
            item.menuItem?.price != null
              ? formatPriceWithSymbol(item.menuItem.price).replace('¥', '')
              : '-';
          const salesCount =
            typeof item.menuItem?.salesCount === 'number' ? item.menuItem.salesCount : 0;
          const removing = isRowPending(`fav:${item.menuItemId}`);

          return (
            <View
              key={item.id || item.menuItemId}
              className={`favorite-card${available ? '' : ' favorite-card--disabled'}`}
              aria-label={`收藏菜品 ${name}`}
            >
              <FoodThumb
                className='favorite-card__thumb'
                src={item.menuItem?.imageUrl}
                name={item.menuItem?.name}
                size='md'
              />
              <View className='favorite-card__info'>
                <View className='favorite-card__top'>
                  <Text className='favorite-card__name'>{name}</Text>
                  {item.menuItem?.description ? (
                    <Text className='favorite-card__desc'>{item.menuItem.description}</Text>
                  ) : null}
                </View>
                <View className='favorite-card__bottom'>
                  <View className='favorite-card__meta'>
                    <View className='favorite-card__price-row'>
                      <Text className='favorite-card__price-unit'>¥</Text>
                      <Text className='favorite-card__price'>{priceText}</Text>
                    </View>
                    {available ? (
                      <Text className='favorite-card__sales'>月售 {salesCount}</Text>
                    ) : (
                      <Text className='favorite-card__sales'>已下架</Text>
                    )}
                  </View>
                  <View className='favorite-card__actions'>
                    <View
                      className={`favorite-card__favorite is-active${removing ? ' is-pending' : ''}`}
                      onClick={() => handleRemove(item)}
                      aria-label={`取消收藏 ${name}`}
                    >
                      {removing ? (
                        <Text className='favorite-card__favorite-pending'>···</Text>
                      ) : (
                        <Icon name='heart-filled' size={16} color='#FF4D4F' />
                      )}
                    </View>
                    <View
                      className={`favorite-card__add-btn${available ? '' : ' is-disabled'}`}
                      onClick={() => available && handleAddToCart(item)}
                      aria-label={`添加 ${name} 到购物车`}
                    >
                      <Text className='favorite-card__add-icon'>
                        {addingId === item.menuItemId ? '…' : '+'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
        <ListEndTip show={favorites.length > 0} hasMore={false} />
      </View>
      <FooterBar actionOnly actionText='去点餐' onAction={goMenu} />
    </View>
  );
}
