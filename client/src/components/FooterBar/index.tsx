import { memo, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface FooterBarProps {
  totalLabel?: string;
  totalText?: string;
  actionText?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  className?: string;
}

function FooterBarInner({
  totalLabel = '合计：',
  totalText,
  actionText,
  actionDisabled,
  onAction,
  className = '',
  children,
}: PropsWithChildren<FooterBarProps>) {
  return (
    <View className={`tf-footer-bar ${className}`.trim()}>
      {children ? (
        children
      ) : (
        <>
          <View className='tf-footer-bar__left'>
            {totalLabel ? <Text className='tf-footer-bar__label'>{totalLabel}</Text> : null}
            {totalText ? <Text className='tf-footer-bar__total'>{totalText}</Text> : null}
          </View>
          {actionText ? (
            <View
              className={`tf-footer-bar__action${actionDisabled ? ' is-disabled' : ''}`}
              onClick={() => {
                if (!actionDisabled && onAction) onAction();
              }}
            >
              {actionText}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export default memo(FooterBarInner);
