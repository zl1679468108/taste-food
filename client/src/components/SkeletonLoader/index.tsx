import { memo, useMemo } from 'react';
import { View } from '@tarojs/components';
import './index.scss';

type SkeletonMode = 'list' | 'card' | 'detail' | 'address' | 'favorites';

interface SkeletonLoaderProps {
  mode?: SkeletonMode;
  count?: number;
}

function SkeletonLoaderInner({ mode = 'list', count = 4 }: SkeletonLoaderProps) {
  const content = useMemo(() => {
    if (mode === 'list') {
      return (
        <View className='skeleton-list'>
          <View className='skeleton-list__sidebar'>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} className='skeleton__shimmer' />
            ))}
          </View>
          <View className='skeleton-list__content'>
            {Array.from({ length: count }).map((_, i) => (
              <View key={i} className='skeleton-menu-item'>
                <View className='skeleton-menu-item__img skeleton__shimmer' />
                <View className='skeleton-menu-item__info'>
                  <View className='skeleton-menu-item__line skeleton__shimmer' />
                  <View className='skeleton-menu-item__line-short skeleton__shimmer' />
                  <View className='skeleton-menu-item__bottom'>
                    <View className='skeleton-menu-item__price skeleton__shimmer' />
                    <View className='skeleton-menu-item__btn skeleton__shimmer' />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (mode === 'card') {
      return (
        <View className='skeleton-order-list'>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} className='skeleton-order-card'>
              <View className='skeleton-order-card__header'>
                <View className='skeleton-order-card__shop skeleton__shimmer' />
                <View className='skeleton-order-card__status skeleton__shimmer' />
              </View>
              <View className='skeleton-order-card__goods skeleton__shimmer' />
              <View className='skeleton-order-card__goods skeleton__shimmer skeleton-order-card__goods--short' />
              <View className='skeleton-order-card__footer'>
                <View className='skeleton-order-card__time skeleton__shimmer' />
                <View className='skeleton-order-card__total skeleton__shimmer' />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (mode === 'address') {
      return (
        <View className='skeleton-address-list'>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} className='skeleton-address-card'>
              <View className='skeleton-address-card__row'>
                <View className='skeleton-address-card__name skeleton__shimmer' />
                <View className='skeleton-address-card__phone skeleton__shimmer' />
                <View className='skeleton-address-card__tag skeleton__shimmer' />
              </View>
              <View className='skeleton-address-card__detail skeleton__shimmer' />
              <View className='skeleton-address-card__detail skeleton__shimmer skeleton-address-card__detail--short' />
              <View className='skeleton-address-card__actions'>
                <View className='skeleton-address-card__action skeleton__shimmer' />
                <View className='skeleton-address-card__action skeleton__shimmer' />
                <View className='skeleton-address-card__action skeleton__shimmer' />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (mode === 'favorites') {
      return (
        <View className='skeleton-favorites-list'>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} className='skeleton-favorite-card'>
              <View className='skeleton-favorite-card__img skeleton__shimmer' />
              <View className='skeleton-favorite-card__info'>
                <View className='skeleton-favorite-card__line skeleton__shimmer' />
                <View className='skeleton-favorite-card__line-short skeleton__shimmer' />
                <View className='skeleton-favorite-card__bottom'>
                  <View className='skeleton-favorite-card__price skeleton__shimmer' />
                  <View className='skeleton-favorite-card__actions'>
                    <View className='skeleton-favorite-card__btn skeleton__shimmer' />
                    <View className='skeleton-favorite-card__btn skeleton__shimmer' />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View className='skeleton-detail'>
        <View className='skeleton-detail__hero skeleton__shimmer' />
        <View className='skeleton-detail__timeline'>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} className='skeleton-detail__timeline-item'>
              <View className='skeleton-detail__dot skeleton__shimmer' />
              <View className='skeleton-detail__timeline-content'>
                <View className='skeleton-detail__line skeleton__shimmer' />
                <View className='skeleton-detail__line-short skeleton__shimmer' />
              </View>
            </View>
          ))}
        </View>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} className='skeleton-detail__card'>
            <View className='skeleton-detail__card-title skeleton__shimmer' />
            <View className='skeleton-detail__card-row skeleton__shimmer' />
            <View className='skeleton-detail__card-row skeleton__shimmer' />
          </View>
        ))}
      </View>
    );
  }, [mode, count]);

  return content;
}

export default memo(SkeletonLoaderInner);
