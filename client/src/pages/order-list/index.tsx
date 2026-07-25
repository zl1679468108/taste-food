import { useState, useEffect, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, isRetryableError } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { Order, OrderStatus } from '../../types/order';
import { PaginatedData } from '../../types/api';
import { onOrderUpdated, removePageListeners } from '../../services/socket';
import { DEFAULT_SHOP_ID } from '../../env';
import FilterTabs from '../../components/FilterTabs';
import OrderCard from '../../components/OrderCard';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import VirtualList from '../../components/VirtualList';
import './index.scss';

const ORDER_CARD_HEIGHT = 148;

const FILTER_TABS = [
  { key: '', label: '全部' },
  { key: OrderStatus.PENDING_PAYMENT, label: '待支付' },
  { key: OrderStatus.PAID, label: '已支付' },
  { key: OrderStatus.ACCEPTED, label: '已接单' },
  { key: OrderStatus.PREPARING, label: '制作中' },
  { key: OrderStatus.DELIVERING, label: '配送中' },
  { key: OrderStatus.COMPLETED, label: '已完成' },
  { key: OrderStatus.CANCELLED, label: '已取消' },
];

const OrderListPage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);

  // 本地状态
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [shopName, setShopName] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [canRetry, setCanRetry] = useState(false);

  /** 加载店铺名称 */
  const loadShopName = async () => {
    try {
      const res = await get<any>(`/shops/${DEFAULT_SHOP_ID}`);
      setShopName(res.data?.name || '');
    } catch (e) {
      console.error('加载店铺信息失败:', e);
    }
  };

  /** 加载订单列表 */
  const loadOrders = async (pageNum: number, filter?: string) => {
    const currentFilter = filter !== undefined ? filter : activeFilter;

    if (!isLoggedIn) {
      setLoading(false);
      return;
    }

    if (pageNum === 1) {
      setLoading(true);
      setLoadError(false);
      setCanRetry(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: Record<string, any> = {
        user_id: user?.userId || '',
        page: pageNum,
        pageSize,
      };
      if (currentFilter) {
        params.status = currentFilter;
      }

      const response = await get<PaginatedData<Order>>('/orders', params);
      const { items, total } = response.data;
      const maxPage = Math.ceil(total / pageSize);

      setOrders((prev) => (pageNum === 1 ? items : [...prev, ...items]));
      setLoadError(false);
      setCanRetry(false);
      setLoading(false);
      setLoadingMore(false);
      setPage(pageNum);
      setHasMore(pageNum < maxPage);
    } catch (error: any) {
      setLoading(false);
      setLoadingMore(false);
      if (pageNum === 1) {
        setLoadError(true);
        setCanRetry(isRetryableError(error));
        setOrders([]);
      }
      console.error('加载订单列表失败:', error);
    }
  };

  // 保持 loadOrders 的最新引用，供 socket 回调调用（避免闭包过期）
  const loadOrdersRef = useRef(loadOrders);
  loadOrdersRef.current = loadOrders;

  useEffect(() => {
    loadOrders(1);
    loadShopName();
    onOrderUpdated(() => {
      loadOrdersRef.current(1);
    }, 'order-list');

    return () => {
      removePageListeners('order-list');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 下拉刷新 */
  Taro.usePullDownRefresh(() => {
    setRefreshing(true);
    // 使用 finally 确保 stopPullDownRefresh 始终执行，避免异常时动画卡死
    loadOrders(1).finally(() => {
      Taro.stopPullDownRefresh();
      setRefreshing(false);
    });
  });

  /** 切换筛选 */
  const switchFilter = (filter: string) => {
    setActiveFilter(filter);
    setPage(1);
    loadOrders(1, filter);
  };

  /** 加载更多 */
  const loadMore = () => {
    if (hasMore && !loadingMore) {
      loadOrders(page + 1);
    }
  };

  /** 跳转订单详情 */
  const goToDetail = (orderId: string) => {
    Taro.navigateTo({ url: `/pages/order-detail/index?orderId=${orderId}` });
  };

  /** 获取状态颜色 */

  if (loading) {
    return (
      <View className='order-list-page'>
        <SkeletonLoader mode='card' count={4} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View className='order-list-page'>
        <EmptyState
          icon='🔒'
          title='请先登录'
          description='登录后可查看订单'
          actionText='去登录'
          onAction={() => Taro.navigateTo({ url: '/pages/auth/login' })}
        />
      </View>
    );
  }

  return (
    <View className='order-list-page'>
      <FilterTabs
        tabs={FILTER_TABS}
        activeKey={activeFilter}
        onChange={switchFilter}
      />

      {loadError ? (
        <EmptyState
          icon='⚠️'
          title='加载失败'
          description={canRetry ? '网络不稳定，请重试' : '订单列表暂时无法获取'}
          actionText={canRetry ? '点击重试' : '去点餐'}
          onAction={() => {
            if (canRetry) {
              loadOrders(1);
            } else {
              Taro.switchTab({ url: '/pages/menu/index' });
            }
          }}
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon='📋'
          title='暂无订单'
          description='去点一份喜欢的吧'
          actionText='去点餐'
          onAction={() => Taro.switchTab({ url: '/pages/menu/index' })}
        />
      ) : (
        <View className='order-list-page__list'>
          <VirtualList
            data={orders}
            itemHeight={ORDER_CARD_HEIGHT}
            height='calc(100vh - 48px)'
            keyExtractor={(order) => order.id}
            onScrollToLower={() => loadMore()}
            renderItem={(order) => (
              <OrderCard
                order={order}
                shopName={shopName || '店铺'}
                onClick={() => goToDetail(order.id)}
              />
            )}
          />
          {loadingMore && (
            <View className='load-more'>
              <Text>加载中...</Text>
            </View>
          )}
          {!hasMore && orders.length > 0 && (
            <View className='load-more'>
              <Text>—— 没有更多了 ——</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default OrderListPage;
