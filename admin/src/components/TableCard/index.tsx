import React from 'react';
import { Card } from 'antd';
import { brand } from '@/theme';

interface TableCardProps {
  children: React.ReactNode;
  className?: string;
}

const TableCard: React.FC<TableCardProps> = ({ children, className }) => (
  <Card
    bordered={false}
    className={className}
    style={{
      borderRadius: brand.radius,
      boxShadow: brand.shadow,
    }}
  >
    {children}
  </Card>
);

export default TableCard;
