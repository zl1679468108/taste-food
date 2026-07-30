import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { get, post, isRetryableError, isDuplicateSubmitError } from '../../utils/request';
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
import { useKeyedAsyncAction } from '../../hooks/useAsyncAction';
import { useRiderLocationTracker } from '../../hooks/useRiderLocationTracker';
import './index.scss';
import ListEndTip from '../../components/ListEndTip';
import FooterBar from '../../components/FooterBar';

/** 定位状态用的秒级相对时间（shared 的 formatRelativeTime 只到分钟，粒度不够） */
function formatSyncedAgo(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 10) return '刚刚';
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  return `${Math.floor(minutes / 60)} 小时前`;
}

const RiderPage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);

  // 本地状态
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pool' | 'mine'>('pool');
  const [loadError, setLoadError] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [shopNameMap, setShopNameMap] = useState<Record<string, string>>({});
  // 每 10s 走一次，驱动「位置已同步 · x 秒前」文案自动刷新
  const [nowTick, setNowTick] = useState(() => Date.now());

  // 列表按 key 维度互斥（ref 判定，可挡同一 tick 连点）：
  // grab:${orderId} / deliver:${orderId} / track:${orderId}
  const rowAction = useKeyedAsyncAction();

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

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

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
  const handleGrab = (orderId: string) =>
    rowAction.run(`grab:${orderId}`, async () => {
      try {
        await post(`/orders/${orderId}/grab`);
        Taro.showToast({ title: '抢单成功', icon: 'success' });
        loadData();
      } catch (e) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(e)) return;
        console.error('抢单失败:', e);
        Taro.showToast({ title: '抢单失败', icon: 'none' });
      }
    });

  /** 确认送达 */
  const handleDeliver = (orderId: string) =>
    rowAction.run(`deliver:${orderId}`, async () => {
      try {
        await post(`/orders/${orderId}/deliver`);
        Taro.showToast({ title: '确认送达成功', icon: 'success' });
        loadData();
      } catch (e) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(e)) return;
        console.error('确认送达失败:', e);
        Taro.showToast({ title: '确认送达失败', icon: 'none' });
      }
    });

  // 有配送中订单时才开启定位，避免空跑消耗骑手电量
  const deliveringCount = orders.filter(
    (o) => o.status === OrderStatus.DELIVERING && o.deliveryType === 'delivery',
  ).length;
  const isRider = isLoggedIn && user?.role === 'rider';
  const tracker = useRiderLocationTracker(isRider && deliveringCount > 0);
  const trackerHint = (() => {
    if (tracker.status === 'denied') return '定位未开启，用户看不到你的位置';
    if (tracker.status === 'error') return '位置同步失败，正在自动重试';
    if (tracker.lastReportedAt > 0) {
      return `位置已同步 · ${formatSyncedAgo(tracker.lastReportedAt, nowTick)}`;
    }
    return '正在获取定位...';
  })();

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

      {activeTab === 'mine' && deliveringCount > 0 && (
        <View className={`rider-tracker rider-tracker--${tracker.status}`}>
          <View className='rider-tracker__dot' />
          <View className='rider-tracker__body'>
            <Text className='rider-tracker__title'>实时定位中</Text>
            <Text className='rider-tracker__desc'>{trackerHint}</Text>
          </View>
          {tracker.status === 'denied' ? (
            <Text className='rider-tracker__action' onClick={tracker.retry}>
              开启定位
            </Text>
          ) : (
            <Text className='rider-tracker__count'>{deliveringCount} 单</Text>
          )}
        </View>
      )}

      <ScrollView scrollY enhanced showScrollbar={false} className='order-list'>
        {loading ? (
          <SkeletonLoader mode='rider-card' count={3} />
        ) : loadError ? (
          <>
            <EmptyState
              icon='warning'
              title='加载失败'
              description={canRetry ? '网络不太稳，点一下再试试' : '订单暂时加载不出来'}
            />
            <FooterBar
              actionOnly
              avoidTabBar
              actionText={canRetry ? '再试一次' : '重新加载'}
              onAction={() => loadData()}
            />
          </>
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
                    className={`btn grab-btn${rowAction.isPending(`grab:${order.id}`) ? ' disabled' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation?.();
                      handleGrab(order.id);
                    }}
                  >
                    {rowAction.isPending(`grab:${order.id}`) ? '抢单中...' : '抢单'}
                  </View>
                ) : order.status === OrderStatus.DELIVERING ? (
                  <View className='rider-actions'>
                    <View
                      className={`btn deliver-btn${rowAction.isPending(`deliver:${order.id}`) ? ' disabled' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation?.();
                        handleDeliver(order.id);
                      }}
                    >
                      {rowAction.isPending(`deliver:${order.id}`) ? '提交中...' : '确认送达'}
                    </View>
                  </View>
                ) : (
                  <Text className='value'>{order.address || '到店自取'}</Text>
                )
              }
            />
          ))
        )}
        <ListEndTip show={orders.length > 0 && !loading && !loadError} hasMore={false} variant='tab' />
      </ScrollView>
    </View>
  );
};

export default RiderPage;
