import { memo } from 'react';
import { View, Text } from '@tarojs/components';
import Icon from '../Icon';
import './index.scss';

interface FlyInAnimationProps {
  visible: boolean;
}

function FlyInAnimationInner({ visible }: FlyInAnimationProps) {
  if (!visible) return null;
  return (
    <View className='fly-in-animation'>
      <View className='fly-in-animation__icon'><Icon name='cart' size={20} color='#FF6B35' /></View>
    </View>
  );
}

export default memo(FlyInAnimationInner);
