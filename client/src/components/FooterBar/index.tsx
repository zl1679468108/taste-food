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
  /** 仅展示全宽操作按钮（如表单提交） */
  actionOnly?: boolean;
}

function FooterBarInner({
  totalLabel = '合计：',
  totalText,
  actionText,
  actionDisabled,
  onAction,
  className = '',
  actionOnly = false,
  children,
}: PropsWithChildren<FooterBarProps>) {
  return (
    <View
      className={`tf-footer-bar${actionOnly ? ' tf-footer-bar--action-only' : ''} ${className}`.trim()}
    >
      {children ? (
        children
      ) : actionOnly ? (
        actionText ? (
          <View
            className={`tf-footer-bar__full-action${actionDisabled ? ' is-disabled' : ''}`}
            onClick={() => {
              if (!actionDisabled && onAction) onAction();
            }}
          >
            <Text>{actionText}</Text>
          </View>
        ) : null
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
