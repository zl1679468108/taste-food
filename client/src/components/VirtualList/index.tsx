import { memo, useMemo, useState, useCallback, type ReactNode } from 'react';
import { ScrollView, View } from '@tarojs/components';
import type { CommonEventFunction } from '@tarojs/components';
import './index.scss';

interface VirtualListProps<T> {
  data: T[];
  itemHeight: number;
  height: number | string;
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  onScrollToLower?: () => void;
  className?: string;
  lowerThreshold?: number;
  /** 列表底部内容（紧随最后一项，如“没有更多了”） */
  footer?: ReactNode;
}

/**
 * 轻量虚拟列表：固定行高窗口化渲染。
 * 适用于订单列表等均高卡片场景，无需 Skyline。
 */
function VirtualListInner<T>({
  data,
  itemHeight,
  height,
  keyExtractor,
  renderItem,
  overscan = 4,
  onScrollToLower,
  className = '',
  lowerThreshold = 80,
  footer,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback<CommonEventFunction>(({ detail }) => {
    setScrollTop(detail.scrollTop || 0);
  }, []);

  const totalHeight = data.length * itemHeight;
  const viewport = typeof height === 'number' ? height : 600;

  const { start, end, offsetY } = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(viewport / itemHeight) + overscan * 2;
    const endIndex = Math.min(data.length, startIndex + visibleCount);
    return {
      start: startIndex,
      end: endIndex,
      offsetY: startIndex * itemHeight,
    };
  }, [scrollTop, itemHeight, overscan, viewport, data.length]);

  const visibleItems = data.slice(start, end);

  return (
    <ScrollView
      className={`tf-virtual-list ${className}`.trim()}
      scrollY
      style={{ height }}
      onScroll={onScroll}
      onScrollToLower={onScrollToLower}
      lowerThreshold={lowerThreshold}
      enhanced
      showScrollbar={false}
      scrollWithAnimation={false}
    >
      <View className='tf-virtual-list__content'>
        <View className='tf-virtual-list__phantom' style={{ height: `${totalHeight}px` }}>
          <View
            className='tf-virtual-list__window'
            style={{ transform: `translateY(${offsetY}px)` }}
          >
            {visibleItems.map((item, i) => {
              const index = start + i;
              return (
                <View
                  key={keyExtractor(item, index)}
                  className='tf-virtual-list__item'
                  style={{ height: `${itemHeight}px` }}
                >
                  {renderItem(item, index)}
                </View>
              );
            })}
          </View>
        </View>
        {footer ? <View className='tf-virtual-list__footer'>{footer}</View> : null}
      </View>
    </ScrollView>
  );
}

const VirtualList = memo(VirtualListInner) as typeof VirtualListInner;
export default VirtualList;
