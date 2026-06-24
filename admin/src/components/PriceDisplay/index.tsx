import React from 'react';

interface PriceDisplayProps {
  price: number;
  style?: React.CSSProperties;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({ price, style }) => {
  return (
    <span style={{ color: '#f5222d', fontWeight: 500, ...style }}>
      ¥{(price / 100).toFixed(2)}
    </span>
  );
};

export default PriceDisplay;