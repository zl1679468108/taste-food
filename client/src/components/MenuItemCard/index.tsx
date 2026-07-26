import { memo, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import { MenuItem } from '../../types/menu';
import { formatPriceWithSymbol } from '../../utils/format';
import Icon from '../Icon';
import FoodThumb from '../FoodThumb';
import './index.scss';

interface MenuItemCardProps {
  item: MenuItem;
  categoryIndex?: number;
  onItemClick: (item: MenuItem) => void;
  onFavorite: (item: MenuItem) => void;
  /** @deprecated 真实菜品图已替代色调占位 */
  getItemBgColor?: (index: number) => string;
}

function MenuItemCardInner({
  item,
  onItemClick,
  onFavorite,
}: MenuItemCardProps) {
  const handleClick = useCallback(() => onItemClick(item), [onItemClick, item]);
  const handleFavClick = useCallback(
    (e: any) => {
      e.stopPropagation();
      onFavorite(item);
    },
    [onFavorite, item],
  );
  const handleAddClick = useCallback(
    (e: any) => {
      e.stopPropagation();
      onItemClick(item);
    },
    [onItemClick, item],
  );

  const priceText = formatPriceWithSymbol(item.price).replace('¥', '');
  const salesCount = typeof item.salesCount === 'number' ? item.salesCount : 0;

  return (
    <View className='menu-item-card' onClick={handleClick} aria-label={`菜品 ${item.name}`}>
      <FoodThumb
        src={item.imageUrl}
        name={item.name}
        size='md'
        className='menu-item-card__thumb'
      />

      <View className='menu-item-card__info'>
        <View className='menu-item-card__top'>
          <Text className='menu-item-card__name'>{item.name}</Text>
          {!!item.description && (
            <Text className='menu-item-card__desc'>{item.description}</Text>
          )}
        </View>

        <View className='menu-item-card__bottom'>
          <View className='menu-item-card__meta'>
            <View className='menu-item-card__price-row'>
              <Text className='menu-item-card__price-unit'>¥</Text>
              <Text className='menu-item-card__price'>{priceText}</Text>
            </View>
            <Text className='menu-item-card__sales'>月售 {salesCount}</Text>
          </View>

          <View className='menu-item-card__actions'>
            <View
              className={`menu-item-card__favorite${item.isFavorite ? ' is-active' : ''}`}
              onClick={handleFavClick}
              aria-label={item.isFavorite ? '取消收藏' : '收藏菜品'}
            >
              <Icon
                name={item.isFavorite ? 'heart-filled' : 'heart'}
                size={16}
                color={item.isFavorite ? '#FF4D4F' : '#BDBDBD'}
              />
            </View>
            <View
              className='menu-item-card__add-btn'
              onClick={handleAddClick}
              aria-label={`添加 ${item.name} 到购物车`}
            >
              <Text className='menu-item-card__add-icon'>+</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default memo(MenuItemCardInner);
