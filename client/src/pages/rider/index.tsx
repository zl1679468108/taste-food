import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol, formatTime, shortOrderId } from '../../utils/format';
import { ORDER_STATUS_MAP, ORDER_STATUS_COLOR_MAP } from '../../utils/constants';
import { Order, OrderStatus } from '../../types/order';
import { PaginatedData } from '../../types/api';
import { onOrderUpdated, removePageListeners } from '../../services/socket';
import { DEFAULT_SHOP_ID } from '../../env';
import './index.scss';

const RiderPage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);

  // 本地状态
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pool' | 'mine'>('pool');
  const shopId = DEFAULT_SHOP_ID;

  /** 加载数据 */
  const loadData = async (tab?: 'pool' | 'mine') => {
    const currentTab = tab !== undefined ? tab : activeTab;
    setLoading(true);

    try {
      const params: Record<string, string | number> = { page: 1, pageSize: 50 };
      if (currentTab === 'pool') {
        params.shop_id = shopId;
        params.is_pool = 'true';
      } else {
        params.rider_id = user?.userId || '';
      }

      const res = await get<PaginatedData<Order>>('/orders', params);
      setOrders(res.data.items);
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  };

  // 保持 loadData 的最新引用，供 socket 回调调用（避免闭包过期）
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  /** 检查登录状态 */
  const checkAuth = () => {
    if (!isLoggedIn || user?.role !== 'rider') {
      Taro.showToast({ title: '请先以骑手身份登录', icon: 'none' });
      Taro.navigateTo({ url: '/pages/auth/login' });
      return;
    }
    loadData();
  };

  useEffect(() => {
    checkAuth();
    onOrderUpdated(() => {
      loadDataRef.current();
    }, 'rider');

    return () => {
      removePageListeners('rider');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 切换 Tab */
  const switchTab = (tab: 'pool' | 'mine') => {
    setActiveTab(tab);
    loadData(tab);
  };

  /** 抢单 */
  const handleGrab = async (orderId: string) => {
    try {
      await post(`/orders/${orderId}/grab`);
      Taro.showToast({ title: '抢单成功', icon: 'success' });
      loadData();
    } catch (e) {
      console.error('抢单失败:', e);
      Taro.showToast({ title: '抢单失败', icon: 'none' });
    }
  };

  /** 确认送达 */
  const handleDeliver = async (orderId: string) => {
    try {
      await post(`/orders/${orderId}/deliver`);
      Taro.showToast({ title: '确认送达成功', icon: 'success' });
      loadData();
    } catch (e) {
      console.error('确认送达失败:', e);
      Taro.showToast({ title: '确认送达失败', icon: 'none' });
    }
  };

  return (
    <View className='rider-page'>
      <View className='tab-bar'>
        <View
          className={`tab-item ${activeTab === 'pool' ? 'active' : ''}`}
          onClick={() => switchTab('pool')}
        >待抢单</View>
        <View
          className={`tab-item ${activeTab === 'mine' ? 'active' : ''}`}
          onClick={() => switchTab('mine')}
        >我的配送</View>
      </View>

      <ScrollView scrollY className='order-list'>
        {loading ? (
          <View className='loading'>加载中...</View>
        ) : orders.length === 0 ? (
          <View className='empty'>暂无订单</View>
        ) : (
          orders.map(order => (
            <View key={order.id} className='order-card'>
              <View className='card-header'>
                <Text className='order-no'>{shortOrderId(order.id)}</Text>
                <Text className='status' style={{ color: ORDER_STATUS_COLOR_MAP[order.status] }}>
                  {ORDER_STATUS_MAP[order.status]}
                </Text>
              </View>
              <View className='card-body'>
                <View className='info-item'>
                  <Text className='label'>地址：</Text>
                  <Text className='value'>{order.address || '到店自取'}</Text>
                </View>
                <View className='info-item'>
                  <Text className='label'>联系人：</Text>
                  <Text className='value'>{order.contactName || '匿名'} {order.contactPhone}</Text>
                </View>
                <View className='info-item'>
                  <Text className='label'>金额：</Text>
                  <Text className='price'>{formatPriceWithSymbol(order.total)}</Text>
                </View>
              </View>
              <View className='card-footer'>
                {activeTab === 'pool' ? (
                  <View className='btn grab-btn' onClick={() => handleGrab(order.id)}>抢单</View>
                ) : order.status === OrderStatus.DELIVERING ? (
                  <View className='btn deliver-btn' onClick={() => handleDeliver(order.id)}>确认送达</View>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default RiderPage;
