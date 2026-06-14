import { Component } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol, formatRelativeTime } from '../../utils/format';
import { ORDER_STATUS_MAP, ORDER_STATUS_COLOR_MAP } from '../../utils/constants';
import { Order, OrderItem } from '../../types/order';
import { PaginatedData } from '../../types/api';
import { onOrderUpdated, removeAllListeners } from '../../services/socket';
import './index.scss';

interface OrderListState {
  orders: Order[];
  loading: boolean;
  loadingMore: boolean;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

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
    };
  }

  componentDidMount() {
    this.loadOrders(1);
    // 注册 WebSocket 监听
    onOrderUpdated(() => {
      console.log('[WS] 订单列表页收到更新，刷新列表');
      this.loadOrders(1);
    });
  }

  componentWillUnmount() {
    removeAllListeners();
  }

  async loadOrders(page: number) {
    const authState = this.authStore.getState();

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
      const response = await get<PaginatedData<Order>>('/orders', {
        user_id: authState.user?.userId || '',
        page,
        pageSize: this.state.pageSize,
      });

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

  /** 获取商品摘要文本 */
  getGoodsSummary(items: OrderItem[]): string {
    return items.map((item) => `${item.name}x${item.quantity}`).join('、');
  }

  /** 获取状态颜色 */
  getStatusColor(status: string): string {
    return ORDER_STATUS_COLOR_MAP[status] || '#999';
  }

  render() {
    const { orders, loading, loadingMore, hasMore } = this.state;
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
        <ScrollView
          scrollY
          style={{ height: '100vh' }}
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
