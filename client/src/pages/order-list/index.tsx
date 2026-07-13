import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol, formatRelativeTime } from '../../utils/format';
import { ORDER_STATUS_MAP, ORDER_STATUS_COLOR_MAP } from '../../utils/constants';
import { Order, OrderItem, OrderStatus } from '../../types/order';
import { PaginatedData } from '../../types/api';
import { onOrderUpdated, removePageListeners } from '../../services/socket';
import { DEFAULT_SHOP_ID } from '../../env';
import './index.scss';

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
      setLoading(false);
      setLoadingMore(false);
      setPage(pageNum);
      setHasMore(pageNum < maxPage);
    } catch (error: any) {
      setLoading(false);
      setLoadingMore(false);
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
  const getStatusColor = (status: string): string => {
    return ORDER_STATUS_COLOR_MAP[status] || '#999';
  };

  if (loading) {
    return (
      <View className='order-list-page'>
        <View className='list-loading'>
          <Text>加载中...</Text>
        </View>
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View className='order-list-page'>
        <View className='empty-state'>
          <Text className='empty-state__icon'>🔒</Text>
          <Text className='empty-state__text'>请先登录</Text>
          <View
            style={{
              marginTop: 16,
              padding: '8px 24px',
              background: '#e74c3c',
              color: '#fff',
              borderRadius: 20,
              fontSize: 14,
            }}
            onClick={() => Taro.navigateTo({ url: '/pages/auth/login' })}
          >
            去登录
          </View>
        </View>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View className='order-list-page'>
        <View className='empty-state'>
          <Text className='empty-state__icon'>📋</Text>
          <Text className='empty-state__text'>暂无订单</Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 13,
              color: '#bbb',
            }}
          >
            去点餐页面挑选美食吧
          </Text>
          <View
            style={{
              marginTop: 16,
              padding: '8px 24px',
              background: '#e74c3c',
              color: '#fff',
              borderRadius: 20,
              fontSize: 14,
            }}
            onClick={() => Taro.switchTab({ url: '/pages/menu/index' })}
          >
            去点餐
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className='order-list-page'>
      {/* 筛选 Tab */}
      <View className='filter-tabs'>
        {FILTER_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`filter-tab ${activeFilter === tab.key ? 'filter-tab--active' : ''}`}
            onClick={() => switchFilter(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        scrollY
        style={{ height: 'calc(100vh - 48px)' }}
        onScrollToLower={() => loadMore()}
        enhanced
        showScrollbar={false}
      >
        {orders.map((order) => (
          <View
            key={order.id}
            className='order-card'
            onClick={() => goToDetail(order.id)}
          >
            <View className='order-card__header'>
              <Text className='order-card__shop'>{shopName || '店铺'}</Text>
              <Text
                className='order-card__status'
                style={{
                  color: getStatusColor(order.status),
                  background: `${getStatusColor(order.status)}15`,
                }}
              >
                {ORDER_STATUS_MAP[order.status] || order.status}
              </Text>
            </View>
            <View className='order-card__goods'>
              {order.items.slice(0, 3).map((item) => (
                <Text key={item.id} className='order-card__goods-item'>
                  {item.name} x{item.quantity}
                </Text>
              ))}
              {order.items.length > 3 && (
                <Text className='order-card__goods-item' style={{ color: '#ccc' }}>
                  等 {order.items.length} 件商品
                </Text>
              )}
            </View>
            <View className='order-card__footer'>
              <Text className='order-card__time'>
                {formatRelativeTime(order.createdAt)}
              </Text>
              <Text className='order-card__total'>
                合计{' '}
                <Text className='order-card__total-price'>
                  {formatPriceWithSymbol(order.total)}
                </Text>
              </Text>
            </View>
          </View>
        ))}

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
      </ScrollView>
    </View>
  );
};

export default OrderListPage;
