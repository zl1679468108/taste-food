import React from 'react';
import { Empty, Button } from 'antd';

interface EmptyStateProps {
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  description = '暂无数据',
  actionText,
  onAction,
}) => (
  <Empty description={description}>
    {actionText && onAction ? (
      <Button type="primary" onClick={onAction}>
        {actionText}
      </Button>
    ) : null}
  </Empty>
);

export default EmptyState;
