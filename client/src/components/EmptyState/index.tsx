import { memo } from 'react';
import { View, Text } from '@tarojs/components';
import Icon, { isIconName, type IconName } from '../Icon';
import './index.scss';

interface EmptyStateProps {
  /** SVG 图标名；未知名称时按文本兜底展示 */
  icon?: IconName | string;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  /** 适配购物车弹层等窄空间 */
  compact?: boolean;
  className?: string;
}

function EmptyStateInner({
  icon = 'empty',
  title,
  description,
  actionText,
  onAction,
  compact = false,
  className = '',
}: EmptyStateProps) {
  const rootClass = [
    'empty-state',
    compact ? 'empty-state--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View className={rootClass}>
      {isIconName(icon) ? (
        <View className='empty-state__icon-wrap' aria-hidden>
          <View className='empty-state__icon-glow' />
          <Icon
            name={icon}
            size={compact ? 36 : 44}
            color='#FF8F65'
          />
        </View>
      ) : (
        <Text className='empty-state__icon'>{icon}</Text>
      )}
      <Text className='empty-state__title'>{title}</Text>
      {description ? (
        <Text className='empty-state__desc'>{description}</Text>
      ) : null}
      {actionText && onAction ? (
        <View
          className='empty-state__action'
          hoverClass='empty-state__action--hover'
          hoverStayTime={80}
          onClick={onAction}
        >
          <Text className='empty-state__action-text'>{actionText}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default memo(EmptyStateInner);
