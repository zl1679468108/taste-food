import { memo, useEffect, useMemo, useState } from 'react';
import { View, Image } from '@tarojs/components';
import placeholderImg from '../../assets/images/food-placeholder.png';
import { resolveDishImageByName } from '../../utils/dish-images';
import './index.scss';

interface FoodThumbProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  round?: boolean;
  /** 兼容旧调用 */
  tone?: string;
}

function buildCandidates(name?: string, src?: string): string[] {
  const list: string[] = [];
  const remote = (src || '').trim();
  if (remote) list.push(remote);
  const local = resolveDishImageByName(name);
  if (local && local !== remote) list.push(local);
  list.push(placeholderImg);
  return list;
}

function FoodThumbInner({
  src,
  name = '',
  size = 'md',
  className = '',
  round = false,
}: FoodThumbProps) {
  const candidates = useMemo(() => buildCandidates(name, src), [name, src]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [name, src]);

  const safeIndex = Math.min(index, candidates.length - 1);
  const imageSrc = candidates[safeIndex] || placeholderImg;
  const isPlaceholder = imageSrc === placeholderImg;

  return (
    <View
      className={`food-thumb food-thumb--${size}${round ? ' food-thumb--round' : ''}${isPlaceholder ? ' food-thumb--placeholder' : ''} ${className}`.trim()}
    >
      <Image
        className='food-thumb__img'
        src={imageSrc}
        mode='aspectFill'
        lazyLoad
        aria-label={name || (isPlaceholder ? '菜品占位图' : '菜品图')}
        onError={() => {
          setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
        }}
      />
    </View>
  );
}

/** @deprecated 保留兼容，菜单卡片色调占位已由真实图/统一占位替代 */
export function resolveFoodTone(input?: string | number): string {
  if (typeof input === 'number') {
    const tones = ['hot', 'meat', 'veg', 'drink', 'rice'];
    return tones[((input % tones.length) + tones.length) % tones.length];
  }
  return input || 'default';
}

export type FoodThumbTone = string;

export default memo(FoodThumbInner);
