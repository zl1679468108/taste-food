import { memo } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

function EmptyStateInner({ icon = '📋', title, description, actionText, onAction }: EmptyStateProps) {
  return (
    <View className="empty-state">
      <Text className="empty-state__icon">{icon}</Text>
      <Text className="empty-state__title">{title}</Text>
      {description && (
        <Text className="empty-state__desc">{description}</Text>
      )}
      {actionText && onAction && (
        <View className="empty-state__action" onClick={onAction}>
          {actionText}
        </View>
      )}
    </View>
  );
}

export default memo(EmptyStateInner);
