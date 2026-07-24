import React from 'react';
import { Tag } from 'antd';

const MAP: Record<string, { color: string; text: string }> = {
  delivery: { color: 'orange', text: '外卖配送' },
  pickup: { color: 'blue', text: '到店自取' },
  dine_in: { color: 'green', text: '堂食' },
};

interface DeliveryTypeTagProps {
  type?: string;
}

const DeliveryTypeTag: React.FC<DeliveryTypeTagProps> = ({ type }) => {
  const conf = MAP[type || ''] || { color: 'default', text: type || '-' };
  return <Tag color={conf.color}>{conf.text}</Tag>;
};

export default DeliveryTypeTag;
