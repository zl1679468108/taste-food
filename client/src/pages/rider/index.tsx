import { Component } from 'react';
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

interface RiderState {
  orders: Order[];
  loading: boolean;
  activeTab: 'pool' | 'mine';
  shopId: string;
}

export default class RiderPage extends Component<{}, RiderState> {
  private authStore = useAuthStore;

  constructor(props: {}) {
    super(props);
    this.state = {
      orders: [],
      loading: true,
      activeTab: 'pool',
      shopId: DEFAULT_SHOP_ID,
    };
  }

  componentDidMount() {
    this.checkAuth();
    onOrderUpdated(() => {
      this.loadData();
    }, 'rider');
  }

  componentWillUnmount() {
    removePageListeners('rider');
  }

  checkAuth() {
    const authState = this.authStore.getState();
    if (!authState.isLoggedIn || authState.user?.role !== 'rider') {
      Taro.showToast({ title: '请先以骑手身份登录', icon: 'none' });
      Taro.navigateTo({ url: '/pages/auth/login' });
      return;
    }
    this.loadData();
  }

  async loadData() {
    const { activeTab, shopId } = this.state;
    const authState = this.authStore.getState();
    this.setState({ loading: true });

    try {
      const params: Record<string, string | number> = { page: 1, pageSize: 50 };
      if (activeTab === 'pool') {
        params.shop_id = shopId;
        params.is_pool = 'true';
      } else {
        params.rider_id = authState.user?.userId || '';
      }

      const res = await get<PaginatedData<Order>>('/orders', params);
      this.setState({ orders: res.data.items, loading: false });
    } catch (e) {
      this.setState({ loading: false });
    }
  }

  switchTab(tab: 'pool' | 'mine') {
    this.setState({ activeTab: tab }, () => this.loadData());
  }

  async handleGrab(orderId: string) {
    try {
      await post(`/orders/${orderId}/grab`);
      Taro.showToast({ title: '抢单成功', icon: 'success' });
      this.loadData();
    } catch (e) {
      console.error('抢单失败:', e);
      Taro.showToast({ title: '抢单失败', icon: 'none' });
    }
  }

  async handleDeliver(orderId: string) {
    try {
      await post(`/orders/${orderId}/deliver`);
      Taro.showToast({ title: '确认送达成功', icon: 'success' });
      this.loadData();
    } catch (e) {
      console.error('确认送达失败:', e);
      Taro.showToast({ title: '确认送达失败', icon: 'none' });
    }
  }

  render() {
    const { orders, loading, activeTab } = this.state;

    return (
      <View className='rider-page'>
        <View className='tab-bar'>
          <View 
            className={`tab-item ${activeTab === 'pool' ? 'active' : ''}`}
            onClick={() => this.switchTab('pool')}
          >待抢单</View>
          <View 
            className={`tab-item ${activeTab === 'mine' ? 'active' : ''}`}
            onClick={() => this.switchTab('mine')}
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
                  <Text className='order-no'>#{shortOrderId(order.id)}</Text>
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
                    <View className='btn grab-btn' onClick={() => this.handleGrab(order.id)}>抢单</View>
                  ) : order.status === OrderStatus.DELIVERING ? (
                    <View className='btn deliver-btn' onClick={() => this.handleDeliver(order.id)}>确认送达</View>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }
}
