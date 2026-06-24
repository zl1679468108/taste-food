import { memo, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import { MenuItem } from '../../types/menu';
import { formatPriceWithSymbol } from '../../utils/format';

interface MenuItemCardProps {
  item: MenuItem;
  categoryIndex: number;
  onItemClick: (item: MenuItem) => void;
  onFavorite: (item: MenuItem) => void;
  getItemBgColor: (index: number) => string;
  getItemEmoji: (name: string) => string;
}

function MenuItemCardInner({
  item, categoryIndex, onItemClick, onFavorite, getItemBgColor, getItemEmoji,
}: MenuItemCardProps) {
  const handleClick = useCallback(() => onItemClick(item), [onItemClick, item]);
  const handleFavClick = useCallback(
    (e: any) => { e.stopPropagation(); onFavorite(item); },
    [onFavorite, item],
  );
  const handleAddClick = useCallback(
    (e: any) => { e.stopPropagation(); onItemClick(item); },
    [onItemClick, item],
  );

  return (
    <View className='menu-item-card' onClick={handleClick}>
      <View className={`menu-item-card__image ${getItemBgColor(categoryIndex)}`}>
        <Text>{getItemEmoji(item.name)}</Text>
      </View>
      <View className='menu-item-card__info'>
        <View>
          <Text className='menu-item-card__name'>{item.name}</Text>
          {item.description && (
            <Text className='menu-item-card__desc'>{item.description}</Text>
          )}
        </View>
        <View className='menu-item-card__bottom'>
          <View>
            <Text className='menu-item-card__price'>
              <Text className='menu-item-card__price-unit'>¥</Text>
              {formatPriceWithSymbol(item.price).replace('¥', '')}
            </Text>
            <Text className='menu-item-card__sales'>月售{item.salesCount}</Text>
            <View
              className='menu-item-card__favorite'
              onClick={handleFavClick}
              style={{ display: 'inline-block', marginLeft: '8px', fontSize: '14px' }}
            >
              {item.isFavorite ? '❤️' : '🤍'}
            </View>
          </View>
          <View className='menu-item-card__add-btn' onClick={handleAddClick}>
            +
          </View>
        </View>
      </View>
    </View>
  );
}

export default memo(MenuItemCardInner);
