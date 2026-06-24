import { memo, useMemo } from 'react';
import { View } from '@tarojs/components';
import './index.scss';

type SkeletonMode = 'list' | 'card' | 'detail';

interface SkeletonLoaderProps {
  mode?: SkeletonMode;
  count?: number;
}

function SkeletonLoaderInner({ mode = 'list', count = 4 }: SkeletonLoaderProps) {
  const content = useMemo(() => {
    if (mode === 'list') {
      return (
        <View className="skeleton-list">
          <View className="skeleton-list__sidebar">
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} className="skeleton__shimmer" />
            ))}
          </View>
          <View className="skeleton-list__content">
            {Array.from({ length: count }).map((_, i) => (
              <View key={i} className="skeleton-card">
                <View className="skeleton-card__img skeleton__shimmer" />
                <View className="skeleton-card__info">
                  <View className="skeleton-card__line skeleton__shimmer" />
                  <View className="skeleton-card__line-short skeleton__shimmer" />
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (mode === 'card') {
      return (
        <View className="skeleton-card-mode">
          <View className="skeleton__shimmer skeleton-card-mode__header" />
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i}>
              <View className="skeleton__shimmer skeleton-card-mode__block" />
              <View className="skeleton-card-mode__divider" />
            </View>
          ))}
          <View className="skeleton-card-mode__footer">
            <View className="skeleton__shimmer" />
            <View className="skeleton__shimmer" />
          </View>
        </View>
      );
    }

    return (
      <View className="skeleton-detail">
        <View className="skeleton__shimmer skeleton-detail__hero" />
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} className="skeleton-detail__row">
            <View className="skeleton__shimmer" />
          </View>
        ))}
      </View>
    );
  }, [mode, count]);

  return content;
}

export default memo(SkeletonLoaderInner);
