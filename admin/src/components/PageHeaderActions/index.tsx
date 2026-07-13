import React from 'react';
import { Button, Space, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface PageHeaderActionsProps {
  icon?: React.ReactNode;
  title: string;
  addText?: string;
  onAdd?: () => void;
  onRefresh?: () => void;
}

const PageHeaderActions: React.FC<PageHeaderActionsProps> = ({
  icon,
  title,
  addText,
  onAdd,
  onRefresh,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
    <Title level={4} style={{ margin: 0 }}>
      {icon}
      {title}
    </Title>
    <Space>
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
