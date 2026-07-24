import { memo, PropsWithChildren, type ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface SectionCardProps {
  title?: string;
  icon?: string;
  className?: string;
  extra?: ReactNode;
}

function SectionCardInner({
  title,
  icon,
  className = '',
  extra,
  children,
}: PropsWithChildren<SectionCardProps>) {
  return (
    <View className={`tf-section-card ${className}`.trim()}>
      {(title || icon || extra) && (
        <View className='tf-section-card__header'>
          {icon ? <Text className='tf-section-card__icon'>{icon}</Text> : null}
          {title ? <Text className='tf-section-card__title'>{title}</Text> : null}
          {extra ? <View className='tf-section-card__extra'>{extra}</View> : null}
        </View>
      )}
      <View className='tf-section-card__body'>{children}</View>
    </View>
  );
}

export default memo(SectionCardInner);
