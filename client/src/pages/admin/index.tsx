import { Component } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol, formatTime, shortOrderId } from '../../utils/format';
import { ORDER_STATUS_MAP, ORDER_STATUS_COLOR_MAP } from '../../utils/constants';
import { Order, OrderStatus } from '../../types/order';
import { PaginatedData } from '../../types/api';
import { onOrderUpdated, onOrderCreated, removeAllListeners } from '../../services/socket';
import './index.scss';

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingCount: number;
  preparingCount: number;
  completedCount: number;
}

interface AdminState {
  stats: OrderStats | null;
  allOrders: Order[];
  loadingStats: boolean;
  loadingOrders: boolean;
  loadingMore: boolean;
  activeTab: string;
  page: number;
  pageSize: number;
  hasMore: boolean;
  selectedOrder: Order | null;
  modalVisible: boolean;
  shopId: string;
}

const TABS = [
  { key: '', label: '全部' },
  { key: OrderStatus.PENDING_PAYMENT, label: '待支付' },
  { key: OrderStatus.PAID, label: '已支付' },
  { key: OrderStatus.PREPARING, label: '制作中' },
  { key: OrderStatus.DELIVERING, label: '配送中' },
  { key: OrderStatus.COMPLETED, label: '已完成' },
  { key: OrderStatus.CANCELLED, label: '已取消' },
];

export default class AdminPage extends Component<{}, AdminState> {
  private authStore = useAuthStore;

  constructor(props: {}) {
    super(props);

    this.state = {
      stats: null,
      allOrders: [],
      loadingStats: true,
      loadingOrders: true,
      loadingMore: false,
      activeTab: '',
      page: 1,
      pageSize: 20,
      hasMore: true,
      selectedOrder: null,
      modalVisible: false,
      shopId: '00000000-0000-0000-0000-000000000001',
    };
  }

  componentDidMount() {
    this.checkAuth();
    this.setupSocketListeners();
  }

  componentDidShow() {
    this.checkAuth();
  }

  componentWillUnmount() {
    removeAllListeners();
  }

  /** 设置 WebSocket 监听 */
  setupSocketListeners() {
    // 监听新订单
    onOrderCreated((data) => {
      console.log('[WS] 管理员收到新订单:', data.order.id);
      Taro.showToast({
        title: `新订单 ¥${(data.order.total / 100).toFixed(2)}`,
        icon: 'none',
        duration: 3000,
      });
      this.loadData();
    });

    // 监听订单更新
    onOrderUpdated((data) => {
      console.log('[WS] 管理员收到订单更新:', data.order.id, data.order.status);
      this.loadData();
    });
  }

  checkAuth() {
    const authState = this.authStore.getState();
    if (!authState.isLoggedIn || authState.user?.role !== 'admin') {
      Taro.showToast({ title: '请先以管理员身份登录', icon: 'none' });
      Taro.navigateTo({ url: '/pages/auth/login' });
      return;
    }
    this.loadData();
  }

  async loadData() {
    this.loadStats();
    this.loadOrders(1);
  }

  async loadStats() {
    this.setState({ loadingStats: true });
    try {
      const { shopId } = this.state;
      const response = await get<OrderStats>(`/orders/stats/${shopId}`);

      // 从订单列表获取其他统计数据
      const allOrdersRes = await get<PaginatedData<Order>>('/orders', {
        shop_id: shopId,
        page: 1,
        pageSize: 100,
      });

      const allOrders = allOrdersRes.data.items;

      this.setState({
        stats: {
          ...response.data,
          totalOrders: allOrders.length,
        },
        loadingStats: false,
      });
    } catch (error: any) {
      this.setState({ loadingStats: false });
      console.error('加载统计数据失败:', error);
    }
  }

  async loadOrders(page: number) {
    const { shopId, activeTab, pageSize } = this.state;

    if (page === 1) {
      this.setState({ loadingOrders: true });
    } else {
      this.setState({ loadingMore: true });
    }

    try {
      const params: Record<string, any> = {
        shop_id: shopId,
        page,
        pageSize,
      };
      if (activeTab) {
        params.status = activeTab;
      }

      const response = await get<PaginatedData<Order>>('/orders', params);
      const { items, total } = response.data;
      const maxPage = Math.ceil(total / pageSize);

      this.setState((prev) => ({
        allOrders: page === 1 ? items : [...prev.allOrders, ...items],
        loadingOrders: false,
        loadingMore: false,
        page,
        hasMore: page < maxPage,
      }));
    } catch (error: any) {
      this.setState({ loadingOrders: false, loadingMore: false });
      console.error('加载订单失败:', error);
    }
  }

  switchTab(tabKey: string) {
    this.setState({ activeTab: tabKey }, () => {
      this.loadOrders(1);
    });
  }

  loadMore() {
    const { hasMore, loadingMore } = this.state;
    if (hasMore && !loadingMore) {
      this.loadOrders(this.state.page + 1);
    }
  }

  /** 更新订单状态 */
  async updateOrderStatus(orderId: string, status: OrderStatus) {
    try {
      await post(`/orders/${orderId}/status`, { status });
      Taro.showToast({ title: '操作成功', icon: 'success' });

      // 关闭弹窗并刷新
      this.setState({ modalVisible: false, selectedOrder: null });
      this.loadOrders(1);
      this.loadStats();
    } catch (error: any) {
      console.error('操作失败:', error);
    }
  }

  /** 打开操作弹窗 */
  openActionModal(order: Order) {
    this.setState({ selectedOrder: order, modalVisible: true });
  }

  /** 获取状态可进行的操作 */
  getAvailableActions(order: Order): { label: string; nextStatus: OrderStatus; type: string }[] {
    const actions: { label: string; nextStatus: OrderStatus; type: string }[] = [];

    switch (order.status) {
      case OrderStatus.PAID:
        actions.push({ label: '确认接单', nextStatus: OrderStatus.ACCEPTED, type: 'primary' });
        actions.push({ label: '拒绝订单', nextStatus: OrderStatus.REJECTED, type: 'danger' });
        break;
      case OrderStatus.ACCEPTED:
        actions.push({ label: '开始制作', nextStatus: OrderStatus.PREPARING, type: 'primary' });
        break;
      case OrderStatus.PREPARING:
        if (order.deliveryType === 'delivery') {
          actions.push({ label: '开始配送', nextStatus: OrderStatus.DELIVERING, type: 'primary' });
        } else {
          actions.push({ label: '完成（自取/堂食）', nextStatus: OrderStatus.COMPLETED, type: 'success' });
        }
        break;
      case OrderStatus.DELIVERING:
        actions.push({ label: '完成配送', nextStatus: OrderStatus.COMPLETED, type: 'success' });
        break;
    }

    return actions;
  }

  /** 获取状态标签样式 */
  getStatusTagStyle(status: string): { color: string; background: string } {
    const color = ORDER_STATUS_COLOR_MAP[status] || '#999';
    return { color, background: `${color}15` };
  }

  render() {
    const {
      stats,
      allOrders,
      loadingStats,
      loadingOrders,
      loadingMore,
      activeTab,
      hasMore,
      selectedOrder,
      modalVisible,
    } = this.state;

    return (
      <View className='admin-page'>
        {/* 统计卡片 */}
        <View className='stats-section'>
          <View className='stat-card'>
            <Text className='stat-card__value'>{stats?.totalOrders || 0}</Text>
            <Text className='stat-card__label'>今日订单</Text>
          </View>
          <View className='stat-card stat-card--revenue'>
            <Text className='stat-card__value'>
              ¥{formatPriceWithSymbol(stats?.totalRevenue || 0).replace('¥', '')}
            </Text>
            <Text className='stat-card__label'>今日营收</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-card__value'>{stats?.pendingCount || 0}</Text>
            <Text className='stat-card__label'>待处理</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-card__value'>{stats?.preparingCount || 0}</Text>
            <Text className='stat-card__label'>制作中</Text>
          </View>
          <View className='stat-card'>
            <Text className='stat-card__value'>{stats?.completedCount || 0}</Text>
            <Text className='stat-card__label'>已完成</Text>
          </View>
        </View>

        {/* Tab 切换 */}
        <ScrollView className='tab-bar' scrollX enhanced showScrollbar={false}>
          {TABS.map((tab) => (
            <View
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'tab-item--active' : ''}`}
              onClick={() => this.switchTab(tab.key)}
            >
              <Text>{tab.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* 订单列表 */}
        <ScrollView
          scrollY
          style={{ height: `calc(100vh - 250px)` }}
          onScrollToLower={() => this.loadMore()}
          enhanced
          showScrollbar={false}
        >
          {loadingOrders ? (
            <View className='list-loading'>
              <Text>加载中...</Text>
            </View>
          ) : allOrders.length === 0 ? (
            <View className='empty-state'>
              <Text className='empty-state__icon'>📋</Text>
              <Text className='empty-state__text'>暂无订单</Text>
            </View>
          ) : (
            <View className='order-list'>
              {allOrders.map((order) => {
                const statusStyle = this.getStatusTagStyle(order.status);
                return (
                  <View
                    key={order.id}
                    className='order-card'
                    onClick={() => this.openActionModal(order)}
                  >
                    <View className='order-card__header'>
                      <Text className='order-card__id'>
                        {shortOrderId(order.id)}
                      </Text>
                      <Text
                        className='order-card__status-tag'
                        style={{
                          color: statusStyle.color,
                          background: statusStyle.background,
                        }}
                      >
                        {ORDER_STATUS_MAP[order.status] || order.status}
                      </Text>
                    </View>
                    <View className='order-card__items'>
                      {order.items.slice(0, 3).map((item) => (
                        <Text key={item.id} className='order-card__item'>
                          {item.name} x{item.quantity}
                        </Text>
                      ))}
                      {order.items.length > 3 && (
                        <Text className='order-card__item' style={{ color: '#ccc' }}>
                          等 {order.items.length} 件商品
                        </Text>
                      )}
                    </View>
                    <View className='order-card__footer'>
                      <Text className='order-card__time'>
                        {formatTime(order.createdAt, 'HH:mm')}
                      </Text>
                      <Text className='order-card__total'>
                        合计{' '}
                        <Text className='order-card__total-price'>
                          {formatPriceWithSymbol(order.total)}
                        </Text>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {loadingMore && (
            <View className='load-more'>
              <Text>加载中...</Text>
            </View>
          )}

          {!hasMore && allOrders.length > 0 && (
            <View className='load-more'>
              <Text>—— 没有更多了 ——</Text>
            </View>
          )}
        </ScrollView>

        {/* 操作弹窗 */}
        {modalVisible && selectedOrder && (
          <View
            className='action-modal'
            onClick={() => this.setState({ modalVisible: false })}
          >
            <View
              className='action-modal__content'
              onClick={(e) => e.stopPropagation()}
            >
              <View className='action-modal__header'>
                <Text className='action-modal__title'>
                  订单 {shortOrderId(selectedOrder.id)}
                </Text>
                <View
                  className='action-modal__close'
                  onClick={() => this.setState({ modalVisible: false })}
                >
                  ✕
                </View>
              </View>
              <View className='action-modal__body'>
                <View className='action-modal__info-row'>
                  <Text className='action-modal__info-label'>状态</Text>
                  <Text
                    className='action-modal__info-value'
                    style={{
                      color: ORDER_STATUS_COLOR_MAP[selectedOrder.status] || '#333',
                    }}
                  >
                    {ORDER_STATUS_MAP[selectedOrder.status] || selectedOrder.status}
                  </Text>
                </View>
                <View className='action-modal__info-row'>
                  <Text className='action-modal__info-label'>用户</Text>
                  <Text className='action-modal__info-value'>{selectedOrder.userId.substring(0, 12)}...</Text>
                </View>
                <View className='action-modal__info-row'>
                  <Text className='action-modal__info-label'>商品</Text>
                  <Text className='action-modal__info-value'>
                    {selectedOrder.items.map((i) => `${i.name}x${i.quantity}`).join('、')}
                  </Text>
                </View>
                <View className='action-modal__info-row'>
                  <Text className='action-modal__info-label'>金额</Text>
                  <Text className='action-modal__info-value' style={{ color: '#e74c3c' }}>
                    {formatPriceWithSymbol(selectedOrder.total)}
                  </Text>
                </View>
                {selectedOrder.remark && (
                  <View className='action-modal__info-row'>
                    <Text className='action-modal__info-label'>备注</Text>
                    <Text className='action-modal__info-value'>{selectedOrder.remark}</Text>
                  </View>
                )}
                <View className='action-modal__info-row'>
                  <Text className='action-modal__info-label'>时间</Text>
                  <Text className='action-modal__info-value'>
                    {formatTime(selectedOrder.createdAt, 'MM-DD HH:mm')}
                  </Text>
                </View>

                {/* 操作按钮 */}
                <View className='action-modal__actions'>
                  {this.getAvailableActions(selectedOrder).map((action) => (
                    <View
                      key={action.nextStatus}
                      className={`action-modal__btn action-modal__btn--${action.type}`}
                      onClick={() =>
                        this.updateOrderStatus(selectedOrder.id, action.nextStatus as OrderStatus)
                      }
                    >
                      {action.label}
                    </View>
                  ))}
                  <View
                    className='action-modal__btn action-modal__btn--secondary'
                    onClick={() => this.setState({ modalVisible: false })}
                  >
                    关闭
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }
}
