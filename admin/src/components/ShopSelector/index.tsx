import React, { useEffect } from 'react';
import { Select, Space, Typography } from 'antd';
import { ShopOutlined } from '@ant-design/icons';
import { useShopContext } from '@/hooks/useShopContext';
import type { Shop } from '@/services/shop';
import { brand } from '@/theme';

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
    loadShops,
    ready,
  } = useShopContext();

  useEffect(() => {
    if (!ready && !loading) {
      void loadShops();
    }
  }, [ready, loading, loadShops]);

  if (!shops.length && !loading) {
    return (
      <Space size={6} style={{ marginRight: 8 }}>
        <ShopOutlined style={{ color: brand.textTertiary }} />
        <Text type="secondary" style={{ fontSize: 13 }}>
          暂无店铺
        </Text>
      </Space>
    );
  }

  return (
    <Space size={6} style={{ marginRight: 4 }}>
      <ShopOutlined style={{ color: brand.primary }} />
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
