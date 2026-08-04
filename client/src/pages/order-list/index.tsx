import { useState, useEffect, useRef } from 'react';
import { ScrollView, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, isRetryableError } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { Order } from '../../types/order';
import { PaginatedData } from '../../types/api';
import { OrderStatusCounts } from '@taste-food/shared/types';
import { onOrderUpdated, removePageListeners } from '../../services/socket';
import { DEFAULT_SHOP_ID } from '../../env';
import FilterTabs from '../../components/FilterTabs';
import OrderCard from '../../components/OrderCard';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';
import ListEndTip from '../../components/ListEndTip';
import FooterBar from '../../components/FooterBar';
import { useSyncTabBar } from '../../hooks/useSyncTabBar';
import { TAB_BAR_PATHS } from '../../utils/tab-bar';
import './index.scss';

const FILTER_TABS = [
  { key: '', label: '全部' },
  { key: 'pending_payment', label: '待支付' },
  { key: 'paid', label: '已支付' },
  { key: 'accepted', label: '已接单' },
  { key: 'preparing', label: '制作中' },
  { key: 'ready_for_delivery', label: '待配送' },
  { key: 'ready_for_pickup', label: '待取餐' },
  { key: 'delivering', label: '配送中' },
  { key: 'refund', label: '退款售后' },
  { key: 'completed', label: '已完成' },
];

const OrderListPage = () => {
  useSyncTabBar(TAB_BAR_PATHS.orderList);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);

  const [orders, setOrders] = useState<Order[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [shopName, setShopName] = useState('');
  const [counts, setCounts] = useState<OrderStatusCounts | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [canRetry, setCanRetry] = useState(false);

  const activeFilterRef = useRef(activeFilter);
  activeFilterRef.current = activeFilter;
  const requestSeqRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const loadShopName = async () => {
    try {
      const res = await get<any>(`/shops/${DEFAULT_SHOP_ID}`);
      setShopName(res.data?.name || '');
    } catch (e) {
      console.error('加载店铺信息失败:', e);
    }
  };

  const loadOrders = async (pageNum: number, filter?: string) => {
    const currentFilter = filter !== undefined ? filter : activeFilterRef.current;
    const seq = ++requestSeqRef.current;

    if (!isLoggedIn) {
      setInitialLoading(false);
      setListLoading(false);
      return;
    }

    if (pageNum === 1) {
      setLoadError(false);
      setCanRetry(false);
      if (!hasLoadedOnceRef.current) {
        setInitialLoading(true);
      } else {
        setListLoading(true);
      }
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

      const response = await get<PaginatedData<Order> & { counts?: OrderStatusCounts }>('/orders', params);

      // 丢弃过期请求，避免筛选切换后旧响应覆盖新列表
      if (seq !== requestSeqRef.current) return;

      const { items, total, counts: respCounts } = response.data;
      // 分组筛选(active/review/refund)由服务端解析；前端不再按单状态二次过滤
      const list = items || [];
      const maxPage = Math.ceil((total || 0) / pageSize);

      setOrders((prev) => (pageNum === 1 ? list : [...prev, ...list]));
      if (respCounts) {
        setCounts(respCounts);
      }
      setLoadError(false);
      setCanRetry(false);
      setPage(pageNum);
      setHasMore(pageNum < maxPage);
      hasLoadedOnceRef.current = true;
    } catch (error: any) {
      if (seq !== requestSeqRef.current) return;
      if (pageNum === 1) {
        setLoadError(true);
        setCanRetry(isRetryableError(error));
        setOrders([]);
      }
      console.error('加载订单列表失败:', error);
    } finally {
      if (seq === requestSeqRef.current) {
        setInitialLoading(false);
        setListLoading(false);
        setLoadingMore(false);
      }
    }
  };

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

  Taro.usePullDownRefresh(() => {
    setRefreshing(true);
    loadOrders(1).finally(() => {
      Taro.stopPullDownRefresh();
      setRefreshing(false);
    });
  });

  const switchFilter = (filter: string) => {
    if (filter === activeFilter) return;
    // 立即更新筛选态，并清空旧列表，避免“状态对不上”
    setActiveFilter(filter);
    activeFilterRef.current = filter;
    setOrders([]);
    setPage(1);
    setHasMore(true);
    setLoadError(false);
    loadOrders(1, filter);
  };

  const loadMore = () => {
    if (hasMore && !loadingMore && !listLoading) {
      loadOrders(page + 1);
    }
  };

  const goToDetail = (orderId: string) => {
    Taro.navigateTo({ url: `/pages/order-detail/index?orderId=${orderId}` });
  };

  if (!isLoggedIn) {
    return (
      <View className='order-list-page'>
        <EmptyState
          icon='lock'
          title='请先登录'
          description='登录后就能查看订单进度'
        />
        <FooterBar
          actionOnly
          avoidTabBar
          actionText='去登录'
          onAction={() => Taro.navigateTo({ url: '/pages/auth/login' })}
        />
      </View>
    );
  }

  return (
    <View className='order-list-page'>
      <FilterTabs
        tabs={FILTER_TABS.map((tab) => ({
          ...tab,
          count: counts
            ? tab.key === ''
              ? counts.all
              : counts[tab.key as keyof OrderStatusCounts] ?? 0
            : undefined,
        }))}
        activeKey={activeFilter}
        onChange={switchFilter}
      />

      {initialLoading ? (
        <View className='order-list-page__body'>
          <SkeletonLoader mode='card' count={4} />
        </View>
      ) : loadError ? (
        <View className='order-list-page__body'>
          <EmptyState
            icon='warning'
            title='加载失败'
            description={canRetry ? '网络不太稳，点一下再试试' : '订单暂时加载不出来'}
          />
          <FooterBar
            actionOnly
            avoidTabBar
            actionText={canRetry ? '再试一次' : '去点餐'}
            onAction={() => {
              if (canRetry) {
                loadOrders(1);
              } else {
                Taro.switchTab({ url: '/pages/menu/index' });
              }
            }}
          />
        </View>
      ) : listLoading ? (
        <View className='order-list-page__body'>
          <SkeletonLoader mode='card' count={4} />
        </View>
      ) : orders.length === 0 ? (
        <View className='order-list-page__body'>
          <EmptyState
            icon='order'
            title={
              activeFilter === 'refund'
                ? '暂无退款售后'
                : activeFilter
                  ? '这里还没有订单'
                  : '还没有订单'
            }
            description={
              activeFilter === 'refund'
                ? '取消、拒单和退款申请会出现在这里'
                : activeFilter
                  ? '换个状态看看，或去点一份喜欢的'
                  : '去点一份喜欢的吧'
            }
          />
          <FooterBar
            actionOnly
            avoidTabBar
            actionText='去点餐'
            onAction={() => Taro.switchTab({ url: '/pages/menu/index' })}
          />
        </View>
      ) : (
        <View className='order-list-page__list'>
          <ScrollView
            key={`orders-${activeFilter || 'all'}`}
            className='order-list-page__scroll'
            scrollY
            enhanced
            showScrollbar={false}
            lowerThreshold={80}
            onScrollToLower={loadMore}
          >
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                shopName={shopName || '店铺'}
                onClick={() => goToDetail(order.id)}
              />
            ))}
            <ListEndTip
              loading={loadingMore}
              hasMore={hasMore}
              show={orders.length > 0}
              variant='tab'
            />
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default OrderListPage;
