import React from 'react';
import { Select, Space, Typography } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useShopContext } from '@/hooks/useShopContext';
import type { Shop } from '@/services/shop';
import ShopLogo from '@/components/ShopLogo';

const { Text } = Typography;

/** 全店视角的特殊值（仅平台管理员可选） */
export const ALL_SHOPS_VALUE = 'all';

/**
 * 顶栏店铺选择器：平台管理员可切换具体门店或选「全店」；商家账号锁定当前店。
 */
const ShopSelector: React.FC = () => {
  const {
    shopId,
    shops,
    loading,
    canSwitchShops,
    scope,
    setScope,
    setShopId,
  } = useShopContext();

  if (!shops.length && !loading) {
    return (
      <Space size={6} className="tf-shop-selector" style={{ marginRight: 'var(--tf-space-2)'}}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          暂无店铺
        </Text>
      </Space>
    );
  }

  // 当前选中值：全店视角时为 ALL_SHOPS_VALUE，否则为具体门店 id
  const value = scope === 'all' ? ALL_SHOPS_VALUE : shopId || undefined;

  const handleChange = (next: string) => {
    if (next === ALL_SHOPS_VALUE) {
      setScope('all');
      return;
    }
    setShopId(next);
  };

  // 平台管理员额外提供「全店」选项；商家仅列具体门店
  const options = [
    ...(canSwitchShops
      ? [{ value: ALL_SHOPS_VALUE, label: '全店', isAll: true }]
      : []),
    ...shops.map((shop: Shop) => ({
      value: shop.id,
      label: shop.name || shop.id,
      isAll: false,
    })),
  ];

  const renderLabel = (optionValue: string, label: React.ReactNode) => {
    if (optionValue === ALL_SHOPS_VALUE) {
      return (
        <Space size={8} align="center">
          <GlobalOutlined style={{ fontSize: 18 }} />
          <span>全店</span>
        </Space>
      );
    }
    const shop = shops.find((item: Shop) => item.id === optionValue);
    return (
      <Space size={8} align="center">
        <ShopLogo src={shop?.logoUrl} size={22} />
        <span>{label}</span>
      </Space>
    );
  };

  return (
    <Space size={6} className="tf-shop-selector" style={{ marginRight: 'var(--tf-space-1)'}}>
      <Select
        size="middle"
        value={value}
        loading={loading}
        disabled={!canSwitchShops && !shops.length}
        style={{ minWidth: 180, maxWidth: 260 }}
        placeholder="选择店铺"
        optionFilterProp="label"
        showSearch
        onChange={handleChange}
        optionRender={(option) => {
          const data = option.data as { value: string; label: React.ReactNode; isAll: boolean };
          return renderLabel(data.value, data.label);
        }}
        labelRender={(props) => renderLabel(props.value as string, props.label)}
        options={options}
        popupMatchSelectWidth={false}
      />
      {!canSwitchShops ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          本店
        </Text>
      ) : null}
    </Space>
  );
};

export default ShopSelector;
