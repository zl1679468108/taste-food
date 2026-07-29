import { memo, useMemo } from 'react';
import { View } from '@tarojs/components';
import type { CSSProperties } from 'react';
import Icon from '../Icon';
import './index.scss';

interface FlyInAnimationProps {
  visible: boolean;
  /** 起点（通常是 + 按钮中心） */
  start?: { x: number; y: number };
  /** 终点（购物车图标中心），缺省时飞向左下角购物车栏大致位置 */
  end?: { x: number; y: number };
}

function FlyInAnimationInner({ visible, start, end }: FlyInAnimationProps) {
  const style = useMemo<CSSProperties | undefined>(() => {
    if (!start) return undefined;
    const fromX = start.x;
    const fromY = start.y;
    // 默认飞向底部购物车图标区域（左侧固定栏附近）
    const toX = end?.x ?? 36;
    const toY = end?.y ?? fromY + 180;
    const dx = toX - fromX;
    const dy = toY - fromY;
    return {
      left: `${fromX - 14}px`,
      top: `${fromY - 14}px`,
      // CSS 变量把位移传给 keyframes
      ['--fly-dx' as string]: `${dx}px`,
      ['--fly-dy' as string]: `${dy}px`,
    };
  }, [start, end]);

  if (!visible || !start || !style) return null;

  return (
    <View className='fly-in-animation' style={style}>
      <View className='fly-in-animation__ball'>
        <Icon name='cart' size={16} color='#FFFFFF' />
      </View>
    </View>
  );
}

export default memo(FlyInAnimationInner);
