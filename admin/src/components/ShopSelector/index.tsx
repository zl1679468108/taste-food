import React from 'react';
import { Select, Space, Typography } from 'antd';
import { useShopContext } from '@/hooks/useShopContext';
import type { Shop } from '@/services/shop';
import ShopLogo from '@/components/ShopLogo';

const { Text } = Typography;

/**
 * 顶栏店铺选择器：平台管理员可切换；商家账号锁定当前店。
 */
const ShopSelector: React.FC = () => {
  const {
    shopId,
    shops,
    loading,
    canSwitchShops,
    setShopId,
  } = useShopContext();

  if (!shops.length && !loading) {
    return (
      <Space size={6} className="tf-shop-selector" style={{ marginRight: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          暂无店铺
        </Text>
      </Space>
    );
  }

  return (
    <Space size={6} className="tf-shop-selector" style={{ marginRight: 4 }}>
      <Select
        size="middle"
        value={shopId || undefined}
        loading={loading}
        disabled={!canSwitchShops}
        style={{ minWidth: 180, maxWidth: 260 }}
        placeholder="选择店铺"
        optionFilterProp="label"
        showSearch
        onChange={(value) => setShopId(value)}
        optionRender={(option) => {
          const shop = shops.find((item: Shop) => item.id === option.value);
          return (
            <Space size={8}>
              <ShopLogo src={shop?.logoUrl} size={24} />
              <span>{option.label}</span>
            </Space>
          );
        }}
        labelRender={(props) => {
          const shop = shops.find((item: Shop) => item.id === props.value);
          return (
            <Space size={8}>
              <ShopLogo src={shop?.logoUrl} size={20} />
              <span>{props.label}</span>
            </Space>
          );
        }}
        options={shops.map((shop: Shop) => ({
          value: shop.id,
          label: shop.name || shop.id,
        }))}
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
