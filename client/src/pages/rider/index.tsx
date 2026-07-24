import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { shortOrderId } from '../../utils/format';
import { Order, OrderStatus } from '../../types/order';
import { PaginatedData } from '../../types/api';
import { onOrderUpdated, removePageListeners } from '../../services/socket';
import { DEFAULT_SHOP_ID } from '../../env';
import FilterTabs from '../../components/FilterTabs';
import OrderCard from '../../components/OrderCard';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import './index.scss';

const RiderPage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);

  // 本地状态
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pool' | 'mine'>('pool');
  const [actingId, setActingId] = useState<string | null>(null);
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

  // 页面再次显示时刷新数据（从详情页返回后保持最新状态）
  useDidShow(() => {
    if (isLoggedIn && user?.role === 'rider') {
      loadDataRef.current();
    }
  });

  const refreshLoader = useCallback(async () => {
    await loadDataRef.current();
  }, []);
  usePullRefresh(refreshLoader);

  /** 切换 Tab */
  const switchTab = (tab: 'pool' | 'mine') => {
    setActiveTab(tab);
    loadData(tab);
  };

  /** 抢单 */
  const handleGrab = async (orderId: string) => {
    if (actingId) return;
    setActingId(orderId);
    try {
      await post(`/orders/${orderId}/grab`);
      Taro.showToast({ title: '抢单成功', icon: 'success' });
      loadData();
    } catch (e) {
      console.error('抢单失败:', e);
      Taro.showToast({ title: '抢单失败', icon: 'none' });
    } finally {
      setActingId(null);
    }
  };

  /** 确认送达 */
  const handleDeliver = async (orderId: string) => {
    if (actingId) return;
    setActingId(orderId);
    try {
      await post(`/orders/${orderId}/deliver`);
      Taro.showToast({ title: '确认送达成功', icon: 'success' });
      loadData();
    } catch (e) {
      console.error('确认送达失败:', e);
      Taro.showToast({ title: '确认送达失败', icon: 'none' });
    } finally {
      setActingId(null);
    }
  };

  return (
    <View className='rider-page'>
      <FilterTabs
        tabs={[
          { key: 'pool', label: '待抢单' },
          { key: 'mine', label: '我的配送' },
        ]}
        activeKey={activeTab}
        onChange={(key) => switchTab(key as 'pool' | 'mine')}
        variant='pill'
        scrollable={false}
      />

      <ScrollView scrollY className='order-list'>
        {loading ? (
          <SkeletonLoader mode='card' count={3} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon='🛵'
            title={activeTab === 'pool' ? '暂无待抢订单' : '暂无配送中订单'}
            description={activeTab === 'pool' ? '有新单会实时提醒' : '抢单后会显示在这里'}
          />
        ) : (
          orders.map(order => (
            <OrderCard
              key={order.id}
              order={{ ...order, items: order.items || [] }}
              shopName={shortOrderId(order.id)}
              footerExtra={
                activeTab === 'pool' ? (
                  <View
                    className={`btn grab-btn${actingId === order.id ? ' disabled' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation?.();
                      handleGrab(order.id);
                    }}
                  >
                    {actingId === order.id ? '抢单中...' : '抢单'}
                  </View>
                ) : order.status === OrderStatus.DELIVERING ? (
                  <View
                    className={`btn deliver-btn${actingId === order.id ? ' disabled' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation?.();
                      handleDeliver(order.id);
                    }}
                  >
                    {actingId === order.id ? '提交中...' : '确认送达'}
                  </View>
                ) : (
                  <Text className='value'>{order.address || '到店自取'}</Text>
                )
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default RiderPage;
