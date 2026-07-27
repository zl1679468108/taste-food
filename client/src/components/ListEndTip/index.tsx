import { View, Text } from '@tarojs/components';
import './index.scss';

export type ListEndTipProps = {
  /** 是否正在加载更多 */
  loading?: boolean;
  /** 是否还有更多；无分页列表传 false */
  hasMore?: boolean;
  /** 列表有数据时再展示，默认 true */
  show?: boolean;
  loadingText?: string;
  endText?: string;
  /** tab 页 / 固定底栏页等额外留白 */
  variant?: 'default' | 'tab' | 'footer';
  className?: string;
};

/**
 * 列表触底状态提示：加载中 / 没有更多了
 */
export default function ListEndTip({
  loading = false,
  hasMore = false,
  show = true,
  loadingText = '加载中...',
  endText = '—— 没有更多了 ——',
  variant = 'default',
  className = '',
}: ListEndTipProps) {
  if (!show) return null;
  if (!loading && hasMore) return null;

  const variantClass = variant !== 'default' ? ` tf-list-end-tip--${variant}` : '';

  return (
    <View className={`tf-list-end-tip${variantClass} ${className}`.trim()}>
      <Text>{loading ? loadingText : endText}</Text>
    </View>
  );
}
