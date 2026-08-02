import React from 'react';
import { Button, Space, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { brand } from '@/theme';

const { Title } = Typography;

interface PageHeaderActionsProps {
  icon?: React.ReactNode;
  title: string;
  addText?: string;
  onAdd?: () => void;
  onRefresh?: () => void;
  /** 额外操作按钮 */
  extra?: React.ReactNode;
  /** 是否吸顶，默认开启 */
  sticky?: boolean;
}

const PageHeaderActions: React.FC<PageHeaderActionsProps> = ({
  icon,
  title,
  addText,
  onAdd,
  onRefresh,
  extra,
  sticky = true,
}) => (
  <div
    className={sticky ? 'tf-page-header-sticky' : undefined}
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 'var(--tf-space-4)',
      color: brand.textPrimary,
    }}
  >
    <Title level={4} style={{ margin: 0 }}>
      {icon}
      {title}
    </Title>
    <Space>
      {extra}
      {onRefresh && (
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      )}
      {onAdd && addText && (
        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
          {addText}
        </Button>
      )}
    </Space>
  </div>
);

export default PageHeaderActions;
