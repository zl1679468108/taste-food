import { Component } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol, formatRelativeTime } from '../../utils/format';
import { ORDER_STATUS_MAP, ORDER_STATUS_COLOR_MAP } from '../../utils/constants';
import { Order, OrderItem, OrderStatus } from '../../types/order';
import { PaginatedData } from '../../types/api';
import { onOrderUpdated, removePageListeners } from '../../services/socket';
import './index.scss';

interface OrderListState {
  orders: Order[];
  loading: boolean;
  loadingMore: boolean;
  refreshing?: boolean;
  page: number;
  pageSize: number;
  hasMore: boolean;
  activeFilter: string;
}

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

export default class OrderListPage extends Component<{}, OrderListState> {
  private authStore = useAuthStore;

  constructor(props: {}) {
    super(props);

    this.state = {
      orders: [],
      loading: true,
      loadingMore: false,
      page: 1,
      pageSize: 20,
      hasMore: true,
      activeFilter: '',
    };
  }

  componentDidMount() {
    this.loadOrders(1);
    onOrderUpdated(() => {
      this.loadOrders(1);
    }, 'order-list');
  }

  componentWillUnmount() {
    removePageListeners('order-list');
  }

  /** 下拉刷新 */
  onPullDownRefresh() {
    this.setState({ refreshing: true } as any, () => {
      this.loadOrders(1).then(() => {
        Taro.stopPullDownRefresh();
      });
    });
  }

  async loadOrders(page: number, filter?: string) {
    const authState = this.authStore.getState();
    const activeFilter = filter !== undefined ? filter : this.state.activeFilter;

    if (!authState.isLoggedIn) {
      this.setState({ loading: false });
      return;
    }

    if (page === 1) {
      this.setState({ loading: true });
    } else {
      this.setState({ loadingMore: true });
    }

    try {
      const params: Record<string, any> = {
        user_id: authState.user?.userId || '',
        page,
        pageSize: this.state.pageSize,
      };
      if (activeFilter) {
        params.status = activeFilter;
      }

      const response = await get<PaginatedData<Order>>('/orders', params);
      const { items, total } = response.data;
      const maxPage = Math.ceil(total / this.state.pageSize);

      this.setState((prev) => ({
        orders: page === 1 ? items : [...prev.orders, ...items],
        loading: false,
        loadingMore: false,
        page,
        hasMore: page < maxPage,
      }));
    } catch (error: any) {
      this.setState({ loading: false, loadingMore: false });
      console.error('加载订单列表失败:', error);
    }
  }

  /** 切换筛选 */
  switchFilter(filter: string) {
    this.setState({ activeFilter: filter, page: 1 }, () => {
      this.loadOrders(1);
    });
  }

  /** 加载更多 */
  loadMore() {
    if (this.state.hasMore && !this.state.loadingMore) {
      this.loadOrders(this.state.page + 1);
    }
  }

  /** 跳转订单详情 */
  goToDetail(orderId: string) {
    Taro.navigateTo({ url: `/pages/order-detail/index?orderId=${orderId}` });
  }

  /** 获取状态颜色 */
  getStatusColor(status: string): string {
    return ORDER_STATUS_COLOR_MAP[status] || '#999';
  }

  render() {
    const { orders, loading, loadingMore, hasMore, activeFilter } = this.state;
    const authState = this.authStore.getState();

    if (loading) {
      return (
        <View className='order-list-page'>
          <View className='list-loading'>
            <Text>加载中...</Text>
          </View>
        </View>
      );
    }

    if (!authState.isLoggedIn) {
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
              onClick={() => this.switchFilter(tab.key)}
            >
              <Text>{tab.label}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          scrollY
          style={{ height: 'calc(100vh - 48px)' }}
          onScrollToLower={() => this.loadMore()}
          enhanced
          showScrollbar={false}
        >
          {orders.map((order) => (
            <View
              key={order.id}
              className='order-card'
              onClick={() => this.goToDetail(order.id)}
            >
              <View className='order-card__header'>
                <Text className='order-card__shop'>小买卖烧烤</Text>
                <Text
                  className='order-card__status'
                  style={{
                    color: this.getStatusColor(order.status),
                    background: `${this.getStatusColor(order.status)}15`,
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
  }
}
