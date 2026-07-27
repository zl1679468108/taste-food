import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { get, post, isRetryableError } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { shortOrderId } from '../../utils/format';
import { Order, OrderStatus } from '../../types/order';
import { PaginatedData } from '../../types/api';
import { onOrderUpdated, removePageListeners } from '../../services/socket';
import FilterTabs from '../../components/FilterTabs';
import OrderCard from '../../components/OrderCard';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import './index.scss';
import ListEndTip from '../../components/ListEndTip';

const DEMO_RIDER_COORD = { latitude: 30.27662, longitude: 120.16021 };

const RiderPage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);

  // 本地状态
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pool' | 'mine'>('pool');
  const [actingId, setActingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [shopNameMap, setShopNameMap] = useState<Record<string, string>>({});

  /** 加载店铺名映射（跨店抢单展示用） */
  const ensureShopNames = async (list: Order[]) => {
    const ids = Array.from(new Set(list.map((o) => o.shopId).filter(Boolean)));
    const missing = ids.filter((id) => !shopNameMap[id]);
    if (missing.length === 0) return;
    try {
      const res = await get<Array<{ id: string; name: string }>>('/shops');
      const next = { ...shopNameMap };
      for (const s of res.data || []) {
        if (s?.id) next[s.id] = s.name || s.id;
      }
      setShopNameMap(next);
    } catch {
      // 忽略店名加载失败，卡片回退显示短 ID
    }
  };

  /** 加载数据 */
  const loadData = async (tab?: 'pool' | 'mine') => {
    const currentTab = tab !== undefined ? tab : activeTab;
    setLoading(true);
    setLoadError(false);
    setCanRetry(false);

    try {
      const params: Record<string, string | number> = { page: 1, pageSize: 50 };
      if (currentTab === 'pool') {
        // 跨店抢单池：不传 shop_id，聚合全部店铺待抢单
        params.is_pool = 'true';
      } else {
        params.rider_id = user?.userId || '';
      }

      const res = await get<PaginatedData<Order>>('/orders', params);
      const items = res.data.items || [];
      setOrders(items);
      void ensureShopNames(items);
      setLoadError(false);
      setCanRetry(false);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setOrders([]);
      setLoadError(true);
      setCanRetry(isRetryableError(e));
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

  const getCurrentLocationOrDemo = async () => {
    try {
      const res = await Taro.getLocation({ type: 'gcj02' });
      return {
        latitude: res.latitude,
        longitude: res.longitude,
        speed: res.speed || 0,
        accuracy: res.accuracy || 0,
        source: 'rider_location',
      };
    } catch {
      const drift = (Date.now() % 60000) / 60000;
      return {
        latitude: DEMO_RIDER_COORD.latitude + drift * 0.004,
        longitude: DEMO_RIDER_COORD.longitude + drift * 0.005,
        speed: 0,
        accuracy: 0,
        source: 'demo_location',
      };
    }
  };

  /** 上报配送位置 */
  const handleReportLocation = async (orderId: string) => {
    if (actingId) return;
    setActingId(`track-${orderId}`);
    try {
      const location = await getCurrentLocationOrDemo();
      await post(`/orders/${orderId}/delivery-track`, location);
      Taro.showToast({ title: '位置已更新', icon: 'success' });
    } catch (e) {
      console.error('上报位置失败:', e);
      Taro.showToast({ title: '上报失败', icon: 'none' });
    } finally {
      setActingId(null);
    }
  };

  return (
    <View className='rider-page'>
      <View className='rider-page__mine-entry' onClick={() => Taro.switchTab({ url: '/pages/mine/index' })}>
        <View className='rider-page__mine-entry-left'>
          <Text className='rider-page__mine-entry-title'>我的账号</Text>
          <Text className='rider-page__mine-entry-desc'>账号信息 · 退出登录</Text>
        </View>
        <Text className='rider-page__mine-entry-go'>进入</Text>
      </View>
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
        ) : loadError ? (
          <EmptyState
            icon='warning'
            title='加载失败'
            description={canRetry ? '网络不太稳，点一下再试试' : '订单暂时加载不出来'}
            actionText={canRetry ? '再试一次' : '重新加载'}
            onAction={() => loadData()}
          />
        ) : orders.length === 0 ? (
          <EmptyState
            icon='order'
            title={activeTab === 'pool' ? '暂无待抢订单' : '暂无配送中订单'}
            description={activeTab === 'pool' ? '有新单会及时提醒你' : '抢单后会显示在这里'}
          />
        ) : (
          orders.map(order => (
            <OrderCard
              key={order.id}
              order={{ ...order, items: order.items || [] }}
              shopName={shopNameMap[order.shopId] || shortOrderId(order.shopId || order.id)}
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
                  <View className='rider-actions'>
                    <View
                      className={`btn track-btn${actingId === `track-${order.id}` ? ' disabled' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation?.();
                        handleReportLocation(order.id);
                      }}
                    >
                      {actingId === `track-${order.id}` ? '上报中...' : '上报位置'}
                    </View>
                    <View
                      className={`btn deliver-btn${actingId === order.id ? ' disabled' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation?.();
                        handleDeliver(order.id);
                      }}
                    >
                      {actingId === order.id ? '提交中...' : '确认送达'}
                    </View>
                  </View>
                ) : (
                  <Text className='value'>{order.address || '到店自取'}</Text>
                )
              }
            />
          ))
        )}
        <ListEndTip show={orders.length > 0 && !loading && !loadError} hasMore={false} />
      </ScrollView>
    </View>
  );
};

export default RiderPage;
