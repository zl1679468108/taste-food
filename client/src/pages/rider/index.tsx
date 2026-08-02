import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { API_BASE_URL } from '../../env';
import Taro, { useDidShow } from '@tarojs/taro';
import { get, post, isRetryableError, isDuplicateSubmitError } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { shortOrderId } from '../../utils/format';
import { Order, OrderStatus } from '../../types/order';
import {
  DELIVERY_CONFIRM_ACCURACY_BUFFER_MAX_M,
  DELIVERY_CONFIRM_RADIUS_M,
  DELIVERY_PROOF_MAX_PHOTOS,
  DELIVERY_PROOF_MIN_PHOTOS,
} from '@taste-food/shared/constants';
import { PaginatedData } from '../../types/api';
import { onOrderUpdated, removePageListeners } from '../../services/socket';
import FilterTabs from '../../components/FilterTabs';
import OrderCard from '../../components/OrderCard';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import { useKeyedAsyncAction } from '../../hooks/useAsyncAction';
import { useRiderLocationTracker } from '../../hooks/useRiderLocationTracker';
import { useSyncTabBar } from '../../hooks/useSyncTabBar';
import { TAB_BAR_PATHS } from '../../utils/tab-bar';
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
  useSyncTabBar(TAB_BAR_PATHS.rider);
  // Store 订阅（函数组件中正确订阅变化）
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  // 本地状态
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pool' | 'mine'>('pool');
  const [loadError, setLoadError] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [shopNameMap, setShopNameMap] = useState<Record<string, string>>({});
  const [shopRadiusMap, setShopRadiusMap] = useState<Record<string, number>>({});
  // 每 10s 走一次，驱动「位置已同步 · x 秒前」文案自动刷新
  const [nowTick, setNowTick] = useState(() => Date.now());

  // 列表按 key 维度互斥（ref 判定，可挡同一 tick 连点）：
  // grab:${orderId} / deliver:${orderId} / release:${orderId} / track:${orderId}
  const rowAction = useKeyedAsyncAction();

  /** 加载店铺名映射（跨店抢单展示用） */
  const ensureShopNames = async (list: Order[]) => {
    const ids = Array.from(new Set(list.map((o) => o.shopId).filter(Boolean)));
    const missing = ids.filter((id) => !shopNameMap[id] || shopRadiusMap[id] == null);
    if (missing.length === 0) return;
    try {
      const res = await get<Array<{ id: string; name: string; deliveryConfirmRadiusM?: number }>>('/shops');
      const nextNames = { ...shopNameMap };
      const nextRadius = { ...shopRadiusMap };
      for (const s of res.data || []) {
        if (!s?.id) continue;
        nextNames[s.id] = s.name || s.id;
        if (typeof s.deliveryConfirmRadiusM === 'number') {
          nextRadius[s.id] = s.deliveryConfirmRadiusM;
        }
      }
      setShopNameMap(nextNames);
      setShopRadiusMap(nextRadius);
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

  /** 抢单（池内含 ready_for_delivery 及兼容无骑手旧单） */
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

  /** 释放订单：退回待抢池 */
  const handleRelease = (orderId: string) => {
    Taro.showModal({
      title: '释放订单',
      content: '释放后订单将回到待抢单池，其他骑手可接。确认释放？',
      confirmText: '确认释放',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return;
        void rowAction.run(`release:${orderId}`, async () => {
          try {
            await post(`/orders/${orderId}/release`);
            Taro.showToast({ title: '已释放订单', icon: 'success' });
            loadData();
          } catch (e) {
            if (isDuplicateSubmitError(e)) return;
            console.error('释放订单失败:', e);
            const message =
              (e as any)?.message ||
              (e as any)?.data?.message ||
              '释放失败';
            Taro.showToast({ title: String(message).slice(0, 40), icon: 'none' });
          }
        });
      },
    });
  };

  /** 计算两点距离（米），与后端 haversine 一致，用于客户端预检 */
  const distanceMeters = (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
  };

  const resolveRadiusM = (accuracy?: number, baseRadiusM?: number) => {
    const base =
      typeof baseRadiusM === 'number' && Number.isFinite(baseRadiusM)
        ? baseRadiusM
        : DELIVERY_CONFIRM_RADIUS_M;
    const buffer = Math.min(Math.max(accuracy || 0, 0), DELIVERY_CONFIRM_ACCURACY_BUFFER_MAX_M);
    return base + buffer;
  };

  /** 上传单张送达照片 */
  const uploadProofPhoto = async (filePath: string, order: Order): Promise<string> => {
    if (!token) {
      throw new Error('请先登录');
    }
    const uploadRes = await Taro.uploadFile({
      url: `${API_BASE_URL}/storage/images/delivery-proof`,
      filePath,
      name: 'image',
      header: {
        Authorization: `Bearer ${token}`,
      },
      formData: {
        originalName: 'delivery-proof.jpg',
        orderId: order.id,
        shopId: order.shopId || '',
        shop_id: order.shopId || '',
      },
    });
    let data: any;
    try {
      data = JSON.parse(uploadRes.data);
    } catch {
      throw new Error('上传响应解析失败');
    }
    if (data?.code !== 0 || !data?.data?.url) {
      throw new Error(data?.message || '上传失败');
    }
    return data.data.url as string;
  };

  /**
   * 确认送达：定位围栏预检 → 拍摄/选择 1~3 张现场照片 → 上传 → 提交
   */
  const handleDeliver = (order: Order) =>
    rowAction.run(`deliver:${order.id}`, async () => {
      try {
        // 1) 获取当前位置
        Taro.showLoading({ title: '定位中...', mask: true });
        let location: Taro.getLocation.SuccessCallbackResult;
        try {
          location = await Taro.getLocation({
            type: 'gcj02',
            isHighAccuracy: true,
            highAccuracyExpireTime: 4000,
          });
        } catch (locErr: any) {
          Taro.hideLoading();
          const msg = String(locErr?.errMsg || locErr?.message || '');
          if (msg.includes('auth deny') || msg.includes('authorize') || msg.includes('permission')) {
            Taro.showModal({
              title: '需要定位权限',
              content: '确认送达需校验你是否在收货地址附近，请开启定位权限后重试',
              confirmText: '去设置',
              success: (res) => {
                if (res.confirm) {
                  Taro.openSetting({});
                }
              },
            });
            return;
          }
          Taro.showToast({ title: '定位失败，请重试', icon: 'none' });
          return;
        }

        const accuracy =
          typeof (location as any).accuracy === 'number'
            ? (location as any).accuracy
            : undefined;
        const radiusM = resolveRadiusM(
          accuracy,
          order.deliveryConfirmRadiusM ?? shopRadiusMap[order.shopId],
        );
        const destLat = order.deliveryLatitude;
        const destLng = order.deliveryLongitude;
        if (typeof destLat === 'number' && typeof destLng === 'number') {
          const dist = distanceMeters(
            { latitude: location.latitude, longitude: location.longitude },
            { latitude: destLat, longitude: destLng },
          );
          if (dist > radiusM) {
            Taro.hideLoading();
            const remain = Math.max(0, dist - radiusM);
            await Taro.showModal({
              title: '未到达收货范围',
              content: `当前位置距收货地址约 ${dist} 米（需 ≤${radiusM} 米）。还差约 ${remain} 米，请继续靠近后重试。`,
              showCancel: false,
              confirmText: '知道了',
            });
            return;
          }
        }

        Taro.hideLoading();

        // 2) 拍摄/选择现场照片（1~3 张）
        let mediaRes: Taro.chooseMedia.SuccessCallbackResult;
        try {
          mediaRes = await Taro.chooseMedia({
            count: DELIVERY_PROOF_MAX_PHOTOS,
            mediaType: ['image'],
            sourceType: ['camera'],
            sizeType: ['compressed'],
            camera: 'back',
          });
        } catch (mediaErr: any) {
          const msg = String(mediaErr?.errMsg || mediaErr?.message || '');
          if (msg.includes('cancel')) return;
          Taro.showToast({ title: '请使用相机拍摄送达现场照片', icon: 'none' });
          return;
        }

        const files = (mediaRes.tempFiles || []).filter((f) => !!f.tempFilePath);
        if (files.length < DELIVERY_PROOF_MIN_PHOTOS) {
          Taro.showToast({
            title: `请至少上传 ${DELIVERY_PROOF_MIN_PHOTOS} 张送达照片`,
            icon: 'none',
          });
          return;
        }

        // 3) 上传照片
        Taro.showLoading({ title: '上传照片中...', mask: true });
        const photoUrls: string[] = [];
        try {
          for (const file of files.slice(0, DELIVERY_PROOF_MAX_PHOTOS)) {
            const url = await uploadProofPhoto(file.tempFilePath, order);
            photoUrls.push(url);
          }
        } catch (upErr: any) {
          Taro.hideLoading();
          Taro.showToast({
            title: upErr?.message || '照片上传失败',
            icon: 'none',
          });
          return;
        }

        // 4) 提交确认送达
        Taro.showLoading({ title: '确认送达中...', mask: true });
        await post(`/orders/${order.id}/deliver`, {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy,
          photoUrls,
        });
        Taro.hideLoading();
        Taro.showToast({ title: '确认送达成功', icon: 'success' });
        loadData();
      } catch (e) {
        Taro.hideLoading();
        if (isDuplicateSubmitError(e)) return;
        console.error('确认送达失败:', e);
        const message =
          (e as any)?.message ||
          (e as any)?.data?.message ||
          '确认送达失败';
        Taro.showToast({ title: String(message).slice(0, 40), icon: 'none' });
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
                      className={`btn release-btn${rowAction.isPending(`release:${order.id}`) ? ' disabled' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation?.();
                        handleRelease(order.id);
                      }}
                    >
                      {rowAction.isPending(`release:${order.id}`) ? '释放中...' : '释放订单'}
                    </View>
                    <View
                      className={`btn deliver-btn${rowAction.isPending(`deliver:${order.id}`) ? ' disabled' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation?.();
                        handleDeliver(order);
                      }}
                    >
                      {rowAction.isPending(`deliver:${order.id}`) ? '提交中...' : '确认送达'}
                    </View>
                  </View>
                ) : order.status === OrderStatus.READY_FOR_DELIVERY ? (
                  // 兼容：若「我的」里短暂出现待抢态，仍展示地址文案
                  <Text className='value'>待抢单 · {order.address || '等待骑手接单'}</Text>
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
