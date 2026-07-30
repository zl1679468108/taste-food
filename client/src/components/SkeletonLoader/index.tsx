import { memo, useMemo } from 'react';
import { View } from '@tarojs/components';
import './index.scss';

type SkeletonMode =
  | 'list'
  | 'card'
  | 'rider-card'
  | 'detail'
  | 'address'
  | 'favorites'
  | 'review'
  | 'notification';

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
              <View key={i}>
                {i === 0 ? <View className='skeleton-menu-category skeleton__shimmer' /> : null}
                <View className='skeleton-menu-item'>
                  <View className='skeleton-menu-item__img skeleton__shimmer' />
                  <View className='skeleton-menu-item__info'>
                    <View className='skeleton-menu-item__line skeleton__shimmer' />
                    <View className='skeleton-menu-item__line-short skeleton__shimmer' />
                    <View className='skeleton-menu-item__bottom'>
                      <View className='skeleton-menu-item__price skeleton__shimmer' />
                      <View className='skeleton-menu-item__actions'>
                        <View className='skeleton-menu-item__btn skeleton__shimmer' />
                        <View className='skeleton-menu-item__btn skeleton__shimmer' />
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (mode === 'card' || mode === 'rider-card') {
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
              <View className='skeleton-order-card__goods skeleton__shimmer skeleton-order-card__goods--tiny' />
              <View className='skeleton-order-card__footer'>
                <View className='skeleton-order-card__time skeleton__shimmer' />
                <View className='skeleton-order-card__total skeleton__shimmer' />
              </View>
              {mode === 'rider-card' ? (
                <View className='skeleton-order-card__actions'>
                  <View className='skeleton-order-card__action skeleton__shimmer' />
                  <View className='skeleton-order-card__action skeleton__shimmer' />
                </View>
              ) : null}
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

    if (mode === 'review') {
      return (
        <View className='skeleton-review-list'>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} className='skeleton-review-card'>
              <View className='skeleton-review-card__header'>
                <View className='skeleton-review-card__stars'>
                  {Array.from({ length: 5 }).map((__, starIndex) => (
                    <View key={starIndex} className='skeleton-review-card__star skeleton__shimmer' />
                  ))}
                  <View className='skeleton-review-card__score skeleton__shimmer' />
                </View>
                <View className='skeleton-review-card__time skeleton__shimmer' />
              </View>
              <View className='skeleton-review-card__content skeleton__shimmer' />
              <View className='skeleton-review-card__content skeleton__shimmer skeleton-review-card__content--short' />
              <View className='skeleton-review-card__order skeleton__shimmer' />
              {i % 2 === 0 ? (
                <View className='skeleton-review-card__reply'>
                  <View className='skeleton-review-card__reply-label skeleton__shimmer' />
                  <View className='skeleton-review-card__reply-text skeleton__shimmer' />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      );
    }

    if (mode === 'notification') {
      return (
        <View className='skeleton-notification-list'>
          {Array.from({ length: count }).map((_, i) => (
            <View key={i} className='skeleton-notification-card'>
              <View className='skeleton-notification-card__header'>
                <View className='skeleton-notification-card__title skeleton__shimmer' />
                {i === 0 ? <View className='skeleton-notification-card__dot skeleton__shimmer' /> : null}
              </View>
              <View className='skeleton-notification-card__content skeleton__shimmer' />
              <View className='skeleton-notification-card__content skeleton__shimmer skeleton-notification-card__content--short' />
              <View className='skeleton-notification-card__time skeleton__shimmer' />
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
        <View className='skeleton-detail__timeline-card'>
          <View className='skeleton-detail__timeline-header'>
            <View className='skeleton-detail__title skeleton__shimmer' />
            <View className='skeleton-detail__hint skeleton__shimmer' />
          </View>
          <View className='skeleton-detail__track'>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} className='skeleton-detail__step'>
                <View className='skeleton-detail__rail'>
                  <View className='skeleton-detail__rail-line skeleton__shimmer' />
                  <View className='skeleton-detail__dot skeleton__shimmer' />
                </View>
                <View className='skeleton-detail__step-label skeleton__shimmer' />
                <View className='skeleton-detail__step-time skeleton__shimmer' />
              </View>
            ))}
          </View>
          <View className='skeleton-detail__meta'>
            <View className='skeleton-detail__meta-row skeleton__shimmer' />
            <View className='skeleton-detail__meta-row skeleton__shimmer skeleton-detail__meta-row--short' />
          </View>
        </View>

        <View className='skeleton-detail__card'>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} className='skeleton-detail__info-row'>
              <View className='skeleton-detail__info-label skeleton__shimmer' />
              <View className='skeleton-detail__info-value skeleton__shimmer' />
            </View>
          ))}
        </View>

        <View className='skeleton-detail__goods-card'>
          <View className='skeleton-detail__goods-title skeleton__shimmer' />
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} className='skeleton-detail__goods-item'>
              <View className='skeleton-detail__goods-thumb skeleton__shimmer' />
              <View className='skeleton-detail__goods-main'>
                <View className='skeleton-detail__goods-name skeleton__shimmer' />
                <View className='skeleton-detail__goods-spec skeleton__shimmer' />
              </View>
              <View className='skeleton-detail__goods-qty skeleton__shimmer' />
              <View className='skeleton-detail__goods-price skeleton__shimmer' />
            </View>
          ))}
          <View className='skeleton-detail__summary'>
            <View className='skeleton-detail__summary-row skeleton__shimmer' />
            <View className='skeleton-detail__summary-row skeleton__shimmer' />
            <View className='skeleton-detail__summary-row skeleton__shimmer skeleton-detail__summary-row--total' />
          </View>
        </View>
      </View>
    );
  }, [mode, count]);

  return content;
}

export default memo(SkeletonLoaderInner);
