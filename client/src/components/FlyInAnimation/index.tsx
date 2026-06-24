import { memo } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface FlyInAnimationProps {
  visible: boolean;
}

function FlyInAnimationInner({ visible }: FlyInAnimationProps) {
  if (!visible) return null;
  return (
    <View className='fly-in-animation'>
      <Text className='fly-in-animation__icon'>🛒</Text>
    </View>
  );
}

export default memo(FlyInAnimationInner);
