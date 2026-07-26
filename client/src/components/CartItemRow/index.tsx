import { memo, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import { CartItem } from '../../types/cart';
import { formatPriceWithSymbol } from '../../utils/format';
import FoodThumb from '../FoodThumb';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (key: string, delta: number) => void;
}

function CartItemRowInner({ item, onUpdateQuantity }: CartItemRowProps) {
  const handleDecrease = useCallback(() => onUpdateQuantity(item.key, -1), [onUpdateQuantity, item.key]);
  const handleIncrease = useCallback(() => onUpdateQuantity(item.key, 1), [onUpdateQuantity, item.key]);

  return (
    <View className='cart-popup__item'>
      <FoodThumb
        className='cart-popup__item-thumb'
        src={item.imageUrl}
        name={item.name}
        size='sm'
        round
      />
      <View className='cart-popup__item-info'>
        <Text className='cart-popup__item-name'>{item.name}</Text>
        {item.specDesc && <Text className='cart-popup__item-spec'>{item.specDesc}</Text>}
      </View>
      <Text className='cart-popup__item-price'>{formatPriceWithSymbol(item.price)}</Text>
      <View className='cart-popup__item-actions'>
        <View className='cart-popup__qty-btn' onClick={handleDecrease}>−</View>
        <Text className='cart-popup__qty'>{item.quantity}</Text>
        <View className='cart-popup__qty-btn' onClick={handleIncrease}>+</View>
      </View>
    </View>
  );
}

export default memo(CartItemRowInner);
