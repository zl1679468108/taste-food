import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol, formatTime, shortOrderId } from '../../utils/format';
import { ORDER_STATUS_MAP, ORDER_STATUS_COLOR_MAP } from '../../utils/constants';
import { Order, OrderStatus } from '../../types/order';
import { Category } from '../../types/menu';
import { PaginatedData } from '../../types/api';
import { onOrderUpdated, onOrderCreated, removePageListeners } from '../../services/socket';
import { DEFAULT_SHOP_ID } from '../../env';
import './index.scss';

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingCount: number;
  preparingCount: number;
  completedCount: number;
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

const AdminPage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);

  // 本地状态
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [hasMore, setHasMore] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const shopId = DEFAULT_SHOP_ID;
  const [newOrderBanner, setNewOrderBanner] = useState<{ visible: boolean; order: Order | Record<string, unknown> } | null>(null);

  /** 加载分类 */
  const loadCategories = async () => {
    try {
      const res = await get<any[]>('/categories');
      setCategories(res.data || []);
    } catch (e) {
      console.error('加载分类失败:', e);
    }
  };

  /** 加载统计数据 */
  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const response = await get<OrderStats>(`/orders/stats/${shopId}`);
      // 直接使用 stats 接口返回的 totalOrders，避免用单页 items.length 覆盖导致超 100 时显示错误
      setStats(response.data);
      setLoadingStats(false);
    } catch (error: any) {
      setLoadingStats(false);
      console.error('加载统计数据失败:', error);
    }
  };

  /** 加载订单列表 */
  const loadOrders = async (pageNum: number, tabKey?: string) => {
    const currentTab = tabKey !== undefined ? tabKey : activeTab;

    if (pageNum === 1) {
      setLoadingOrders(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: Record<string, any> = {
        shop_id: shopId,
        page: pageNum,
        pageSize,
      };
      if (currentTab) {
        params.status = currentTab;
      }

      const response = await get<PaginatedData<Order>>('/orders', params);
      const { items, total } = response.data;
      const maxPage = Math.ceil(total / pageSize);

      setAllOrders((prev) => (pageNum === 1 ? items : [...prev, ...items]));
      setLoadingOrders(false);
      setLoadingMore(false);
      setPage(pageNum);
      setHasMore(pageNum < maxPage);
    } catch (error: any) {
      setLoadingOrders(false);
      setLoadingMore(false);
      console.error('加载订单失败:', error);
    }
  };

  /** 加载所有数据 */
  const loadData = () => {
    loadStats();
    loadOrders(1);
    loadCategories();
  };

  // 保持 loadData 的最新引用，供 socket 回调调用（避免闭包过期）
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  /** 设置 WebSocket 监听 */
  const setupSocketListeners = () => {
    // 监听新订单
    onOrderCreated((data) => {
      setNewOrderBanner({ visible: true, order: data.order });
      loadDataRef.current();
    }, 'admin');

    // 监听订单更新
    onOrderUpdated(() => {
      loadDataRef.current();
    }, 'admin');
  };

  /** 关闭新订单横幅 */
  const closeNewOrderBanner = () => {
    setNewOrderBanner(null);
  };

  /** 查看横幅订单 */
  const handleBannerViewOrder = () => {
    const order = newOrderBanner?.order;
    if (order) {
      setNewOrderBanner(null);
      Taro.navigateTo({ url: `/pages/order-detail/index?orderId=${order.id}` });
    }
  };

  /** 检查登录状态 */
  const checkAuth = () => {
    if (!isLoggedIn || user?.role !== 'admin') {
      Taro.showToast({ title: '请先以管理员身份登录', icon: 'none' });
      Taro.navigateTo({ url: '/pages/auth/login' });
      return;
    }
    loadData();
  };

  useEffect(() => {
    checkAuth();
    setupSocketListeners();

    return () => {
      removePageListeners('admin');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  Taro.useDidShow(() => {
    checkAuth();
  });

  /** 切换 Tab */
  const switchTab = (tabKey: string) => {
    setActiveTab(tabKey);
    loadOrders(1, tabKey);
  };

  /** 加载更多 */
  const loadMore = () => {
    if (hasMore && !loadingMore) {
      loadOrders(page + 1);
    }
  };

  /** 更新订单状态 */
  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await post(`/orders/${orderId}/status`, { status });
      Taro.showToast({ title: '操作成功', icon: 'success' });

      // 关闭弹窗并刷新
      setModalVisible(false);
      setSelectedOrder(null);
      loadOrders(1);
      loadStats();
    } catch (error: any) {
      console.error('操作失败:', error);
    }
  };

  /** 打开操作弹窗 */
  const openActionModal = (order: Order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  /** 获取状态可进行的操作 */
  const getAvailableActions = (order: Order): { label: string; nextStatus: OrderStatus; type: string }[] => {
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
          actions.push({ label: '呼叫配送（制作完成）', nextStatus: OrderStatus.DELIVERING, type: 'primary' });
        } else if (order.deliveryType === 'pickup') {
          actions.push({ label: '待自取（制作完成）', nextStatus: OrderStatus.READY_FOR_PICKUP, type: 'primary' });
        } else {
          actions.push({ label: '完成（堂食）', nextStatus: OrderStatus.COMPLETED, type: 'success' });
        }
        break;
      case OrderStatus.READY_FOR_PICKUP:
        actions.push({ label: '确认取餐', nextStatus: OrderStatus.COMPLETED, type: 'success' });
        break;
      case OrderStatus.DELIVERING:
        actions.push({ label: '确认送达', nextStatus: OrderStatus.COMPLETED, type: 'success' });
        break;
    }

    return actions;
  };

  /** 获取状态标签样式 */
  const getStatusTagStyle = (status: string): { color: string; background: string } => {
    const color = ORDER_STATUS_COLOR_MAP[status] || '#999';
    return { color, background: `${color}15` };
  };

  return (
    <View className='admin-page'>
      {/* 新订单横幅通知 */}
      {newOrderBanner && newOrderBanner.visible && (
        <View className='new-order-banner'>
          <View className='new-order-banner__content' onClick={() => handleBannerViewOrder()}>
            <Text className='new-order-banner__icon'>🔔</Text>
            <Text className='new-order-banner__text'>新订单</Text>
            <Text className='new-order-banner__amount'>
              ¥{((newOrderBanner.order.total as number) / 100).toFixed(2)}
            </Text>
          </View>
          <Text
            className='new-order-banner__close'
            onClick={(e) => {
              e.stopPropagation();
              closeNewOrderBanner();
            }}
          >
            ✕
          </Text>
        </View>
      )}
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

      <View className='admin-actions'>
        <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/admin/menu-manage' })}>
          <Text className='action-btn__icon'>🍴</Text>
          <Text>菜品管理</Text>
        </View>
        <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/admin/user-manage' })}>
          <Text className='action-btn__icon'>👥</Text>
          <Text>会员管理</Text>
        </View>
      </View>

      {/* Tab 切换 */}
      <ScrollView className='tab-bar' scrollX enhanced showScrollbar={false}>
        {TABS.map((tab) => (
          <View
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'tab-item--active' : ''}`}
            onClick={() => switchTab(tab.key)}
          >
            <Text>{tab.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 订单列表 */}
      <ScrollView
        scrollY
        style={{ height: `calc(100vh - 250px)` }}
        onScrollToLower={() => loadMore()}
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
              const statusStyle = getStatusTagStyle(order.status);
              return (
                <View
                  key={order.id}
                  className='order-card'
                  onClick={() => openActionModal(order)}
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
          onClick={() => setModalVisible(false)}
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
                onClick={() => setModalVisible(false)}
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
                <Text className='action-modal__info-value' style={{ color: '#FF6B35' }}>
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
                {getAvailableActions(selectedOrder).map((action) => (
                  <View
                    key={action.nextStatus}
                    className={`action-modal__btn action-modal__btn--${action.type}`}
                    onClick={() =>
                      updateOrderStatus(selectedOrder.id, action.nextStatus as OrderStatus)
                    }
                  >
                    {action.label}
                  </View>
                ))}
                <View
                  className='action-modal__btn action-modal__btn--secondary'
                  onClick={() => setModalVisible(false)}
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
};

export default AdminPage;
