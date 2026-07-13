import React from 'react';
import { Card } from 'antd';

interface TableCardProps {
  children: React.ReactNode;
}

const TableCard: React.FC<TableCardProps> = ({ children }) => (
  <Card
    bordered={false}
    style={{
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}
  >
    {children}
  </Card>
);

export default TableCard;
