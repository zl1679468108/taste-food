import React from 'react';
import { Card, Statistic } from 'antd';
import { brand } from '@/theme';

export interface StatisticCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon: React.ReactNode;
  color?: string;
  bgColor?: string;
}

const StatisticCard: React.FC<StatisticCardProps> = ({
  title,
  value,
  suffix,
  icon,
  color = brand.primary,
  bgColor = brand.primaryLight,
}) => (
  <Card
    variant="borderless"
    style={{ borderRadius: brand.radius, boxShadow: brand.shadow }}
  >
    <Statistic
      title={title}
      value={value}
      suffix={suffix}
      prefix={
        <div
          style={{
            color,
            backgroundColor: bgColor,
            width: 48,
            height: 48,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}
        >
          {icon}
        </div>
      }
      valueStyle={{ color: brand.textPrimary, fontWeight: 600 }}
    />
  </Card>
);

export default StatisticCard;
