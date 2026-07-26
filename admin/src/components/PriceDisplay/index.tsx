import React from 'react';
import { brand } from '@/theme';

interface PriceDisplayProps {
  price: number;
  style?: React.CSSProperties;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({ price, style }) => {
  return (
    <span style={{ color: brand.textPrice, fontWeight: 500, ...style }}>
      ¥{(price / 100).toFixed(2)}
    </span>
  );
};

export default PriceDisplay;