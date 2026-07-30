import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Textarea } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { get, post, isDuplicateSubmitError } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { useAsyncAction, useKeyedAsyncAction } from '../../hooks/useAsyncAction';
import { formatPriceWithSymbol, formatTime, shortOrderId } from '../../utils/format';
import { ORDER_STATUS_COLOR_MAP, DELIVERY_TYPE_MAP, getOrderStatusLabel, getMerchantOrderActionHint } from '../../utils/constants';
import { DeliveryTrackPoint, DeliveryType, Order, OrderStatus } from '../../types/order';
import { Category } from '../../types/menu';
import { PaginatedData } from '../../types/api';
import {
  onOrderUpdated,
  onOrderNew,
  onDeliveryTrackUpdated,
  removePageListeners,
  playMerchantNewOrderAlert,
} from '../../services/socket';
import type { OrderNewEvent } from '../../services/socket';
import { DEFAULT_SHOP_ID } from '../../env';
import Icon from '../../components/Icon';
import ListEndTip from '../../components/ListEndTip';
import BottomSheet from '../../components/BottomSheet';
import RiderTrackMap, { toMapPoint } from '../../components/RiderTrackMap';
import './index.scss';

/** 商家新订单横幅数据（优先用 WS 摘要字段） */
interface NewOrderBannerData {
  visible: boolean;
  orderId: string;
  total: number;
  deliveryType: string;
  status: string;
  itemCount: number;
  tableNo?: string;
  address?: string;
  contactName?: string;
}

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
  { key: OrderStatus.PAID, label: '待接单' },
  { key: OrderStatus.ACCEPTED, label: '已接单' },
  { key: OrderStatus.PREPARING, label: '制作中' },
  { key: OrderStatus.READY_FOR_PICKUP, label: '待取餐' },
  { key: OrderStatus.DELIVERING, label: '配送中' },
  { key: OrderStatus.COMPLETED, label: '已完成' },
  { key: OrderStatus.CANCELLED, label: '已取消' },
  { key: OrderStatus.REJECTED, label: '已拒单' },
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
  const [reasonSheetVisible, setReasonSheetVisible] = useState(false);
  const [reasonMode, setReasonMode] = useState<'reject' | 'cancel'>('reject');
  const [reasonText, setReasonText] = useState('');
  const [pendingActionOrderId, setPendingActionOrderId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const shopId = DEFAULT_SHOP_ID;
  const [newOrderBanner, setNewOrderBanner] = useState<NewOrderBannerData | null>(null);
  const [deliveryTrack, setDeliveryTrack] = useState<DeliveryTrackPoint[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [riderDeliveryCount, setRiderDeliveryCount] = useState<number | undefined>(undefined);
  const [paidPendingCount, setPaidPendingCount] = useState(0);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 强守卫：订单状态流转按 `${orderId}:${status}` 维度互斥（列表/弹窗多按钮）
  const statusAction = useKeyedAsyncAction();
  // 强守卫：原因弹层为单例表单，用单一动作互斥
  const { pending: reasonSubmitting, run: runReasonSubmit } = useAsyncAction();
  // 当前详情弹窗的订单 ID，供 socket 回调判断是否需要刷新轨迹（避免闭包过期）
  const trackedOrderIdRef = useRef<string>('');

  /** 加载订单配送轨迹（静默失败，不打断商家操作） */
  const loadDeliveryTrack = async (orderId: string) => {
    setTrackLoading(true);
    try {
      const res = await get<DeliveryTrackPoint[]>(`/orders/${orderId}/delivery-track`, undefined, {
        useCache: false,
        showError: false,
      });
      setDeliveryTrack(res.data || []);
    } catch (error) {
      console.error('加载配送轨迹失败:', error);
      setDeliveryTrack([]);
    } finally {
      setTrackLoading(false);
    }
  };

  const loadDeliveryTrackRef = useRef(loadDeliveryTrack);
  loadDeliveryTrackRef.current = loadDeliveryTrack;

  /** 清空骑手轨迹状态（关闭/切换详情时调用） */
  const resetDeliveryTrack = () => {
    trackedOrderIdRef.current = '';
    setDeliveryTrack([]);
    setTrackLoading(false);
    setRiderDeliveryCount(undefined);
  };

  /** 关闭订单详情弹窗 */
  const closeActionModal = () => {
    setModalVisible(false);
    resetDeliveryTrack();
  };

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
      const response = await get<OrderStats>('/orders/stats/today');
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

  /** 回到前台时补拉 paid 待接单数量（不强制切换当前 Tab 列表） */
  const pullPaidPendingOrders = useCallback(async () => {
    try {
      const response = await get<PaginatedData<Order>>('/orders', {
        shop_id: shopId,
        status: OrderStatus.PAID,
        page: 1,
        pageSize: 20,
      });
      const items = response.data?.items || [];
      setPaidPendingCount(items.length);
    } catch (e) {
      console.error('补拉待接单失败:', e);
    }
  }, [shopId]);

  const pullPaidPendingRef = useRef(pullPaidPendingOrders);
  pullPaidPendingRef.current = pullPaidPendingOrders;

  /** 关闭新订单横幅 */
  const closeNewOrderBanner = () => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setNewOrderBanner(null);
  };

  /** 展示新订单横幅（自动收起） */
  const showNewOrderBanner = (data: OrderNewEvent) => {
    const nested = (data.order || {}) as Record<string, unknown>;
    const orderId = String(data.orderId || nested.id || '');
    if (!orderId) return;

    const banner: NewOrderBannerData = {
      visible: true,
      orderId,
      total: Number(data.total ?? nested.total ?? 0),
      deliveryType: String(data.deliveryType || nested.deliveryType || ''),
      status: String(data.status || nested.status || OrderStatus.PAID),
      itemCount: Number(data.itemCount ?? (Array.isArray(nested.items) ? (nested.items as unknown[]).length : 0)),
      tableNo: String(data.tableNo || nested.tableNo || ''),
      address: String(data.address || nested.address || ''),
      contactName: String(data.contactName || nested.contactName || ''),
    };

    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    setNewOrderBanner(banner);
    // 15s 后自动收起，避免长期遮挡
    bannerTimerRef.current = setTimeout(() => {
      setNewOrderBanner(null);
      bannerTimerRef.current = null;
    }, 15000);
  };

  /** 设置 WebSocket 监听：支付成功 order:new/paid */
  const setupSocketListeners = () => {
    onOrderNew((data) => {
      playMerchantNewOrderAlert();
      showNewOrderBanner(data);
      loadDataRef.current();
      pullPaidPendingRef.current();
    }, 'admin');

    onOrderUpdated(() => {
      loadDataRef.current();
      pullPaidPendingRef.current();
    }, 'admin');

    // 骑手实时定位：仅刷新当前打开详情的那一单
    onDeliveryTrackUpdated((data) => {
      if (!trackedOrderIdRef.current || data.orderId !== trackedOrderIdRef.current) return;
      if (typeof data.riderDeliveryCount === 'number') {
        setRiderDeliveryCount(data.riderDeliveryCount);
      }
      loadDeliveryTrackRef.current(trackedOrderIdRef.current);
    }, 'admin');
  };

  /** 横幅摘要：桌号/地址 */
  const getBannerLocationSummary = (banner: NewOrderBannerData): string => {
    if (banner.deliveryType === 'dine_in') {
      return banner.tableNo ? `桌号 ${banner.tableNo}` : '堂食';
    }
    if (banner.deliveryType === 'pickup') {
      return banner.tableNo ? `自取 ${banner.tableNo}` : '到店自取';
    }
    if (banner.address) {
      return banner.address.length > 16 ? `${banner.address.slice(0, 16)}…` : banner.address;
    }
    return banner.contactName ? `联系人 ${banner.contactName}` : '外卖配送';
  };

  /** 查看横幅订单详情 */
  const handleBannerViewOrder = () => {
    const orderId = newOrderBanner?.orderId;
    if (!orderId) return;
    closeNewOrderBanner();
    Taro.navigateTo({ url: `/pages/order-detail/index?orderId=${orderId}` });
  };

  /** 横幅一键接单 */
  const handleBannerAcceptOrder = () => {
    const orderId = newOrderBanner?.orderId;
    if (!orderId) return;
    return statusAction.run(`${orderId}:${OrderStatus.ACCEPTED}`, async () => {
      try {
        await post(`/orders/${orderId}/status`, { status: OrderStatus.ACCEPTED });
        Taro.showToast({ title: '已接单', icon: 'success' });
        closeNewOrderBanner();
        loadOrders(1);
        loadStats();
        pullPaidPendingOrders();
      } catch (error) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(error)) return;
        console.error('接单失败:', error);
      }
    });
  };

  /** 检查登录状态 */
  const checkAuth = () => {
    if (!isLoggedIn || user?.role !== 'admin') {
      Taro.showToast({ title: '请先以管理员身份登录', icon: 'none' });
      Taro.navigateTo({ url: '/pages/auth/login' });
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (checkAuth()) {
      loadData();
      pullPaidPendingOrders();
    }
    setupSocketListeners();

    return () => {
      removePageListeners('admin');
      trackedOrderIdRef.current = '';
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 回到前台：补拉列表 + paid 待接单
  useDidShow(() => {
    if (!checkAuth()) return;
    loadData();
    pullPaidPendingOrders();
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
  const updateOrderStatus = (orderId: string, status: OrderStatus, reason?: string) =>
    statusAction.run(`${orderId}:${status}`, async () => {
      try {
        await post(`/orders/${orderId}/status`, { status, reason });
        Taro.showToast({
          title: status === OrderStatus.REJECTED ? '已拒单' : '操作成功',
          icon: 'success',
        });

        // 关闭弹窗并刷新
        setReasonSheetVisible(false);
        setReasonText('');
        setPendingActionOrderId(null);
        closeActionModal();
        setSelectedOrder(null);
        loadOrders(1);
        loadStats();
        pullPaidPendingOrders();
      } catch (error: any) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(error)) return;
        console.error('操作失败:', error);
      }
    });

  /** 打开拒单/取消原因弹层 */
  const openReasonSheet = (orderId: string, mode: 'reject' | 'cancel') => {
    setPendingActionOrderId(orderId);
    setReasonMode(mode);
    setReasonText('');
    setReasonSheetVisible(true);
  };

  /** 提交拒单/取消原因 */
  const submitReasonAction = () => {
    if (!pendingActionOrderId) return;
    const reason = reasonText.trim();
    if (!reason) {
      Taro.showToast({ title: reasonMode === 'reject' ? '请填写拒单原因' : '请填写取消原因', icon: 'none' });
      return;
    }
    if (reason.length < 2) {
      Taro.showToast({ title: '原因至少 2 个字', icon: 'none' });
      return;
    }

    return runReasonSubmit(async () => {
      try {
        if (reasonMode === 'reject') {
          await updateOrderStatus(pendingActionOrderId, OrderStatus.REJECTED, reason);
        } else {
          await post(`/orders/${pendingActionOrderId}/cancel`, { reason });
          Taro.showToast({ title: '订单已取消', icon: 'success' });
          setReasonSheetVisible(false);
          setReasonText('');
          setPendingActionOrderId(null);
          closeActionModal();
          setSelectedOrder(null);
          loadOrders(1);
          loadStats();
          pullPaidPendingOrders();
        }
      } catch (error: any) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(error)) return;
        console.error('提交原因失败:', error);
      }
    });
  };

  /** 打开操作弹窗 */
  const openActionModal = (order: Order) => {
    setSelectedOrder(order);
    setModalVisible(true);

    const showTrack =
      order.deliveryType === DeliveryType.DELIVERY && order.status === OrderStatus.DELIVERING;
    resetDeliveryTrack();
    if (showTrack) {
      trackedOrderIdRef.current = order.id;
      setRiderDeliveryCount(
        typeof order.riderDeliveryCount === 'number' ? order.riderDeliveryCount : undefined,
      );
      loadDeliveryTrack(order.id);
    }
  };

  /** 获取状态可进行的操作 */
  const getAvailableActions = (order: Order): { label: string; nextStatus: OrderStatus; type: string }[] => {
    const actions: { label: string; nextStatus: OrderStatus; type: string }[] = [];

    switch (order.status) {
      case OrderStatus.PENDING_PAYMENT:
        actions.push({ label: '取消订单', nextStatus: OrderStatus.CANCELLED, type: 'danger' });
        break;
      case OrderStatus.PAID:
        actions.push({ label: '确认接单', nextStatus: OrderStatus.ACCEPTED, type: 'primary' });
        actions.push({ label: '拒单', nextStatus: OrderStatus.REJECTED, type: 'danger' });
        actions.push({ label: '取消订单', nextStatus: OrderStatus.CANCELLED, type: 'danger' });
        break;
      case OrderStatus.ACCEPTED:
        actions.push({ label: '开始制作', nextStatus: OrderStatus.PREPARING, type: 'primary' });
        break;
      case OrderStatus.PREPARING:
        if (order.deliveryType === 'delivery') {
          actions.push({ label: '开始配送（商家）', nextStatus: OrderStatus.DELIVERING, type: 'primary' });
        } else if (order.deliveryType === 'pickup') {
          actions.push({ label: '待自取（制作完成）', nextStatus: OrderStatus.READY_FOR_PICKUP, type: 'primary' });
        } else {
          // 堂食与自取一致：制作完成先进入待取餐，再确认完成
          actions.push({ label: '待出餐/待取餐（制作完成）', nextStatus: OrderStatus.READY_FOR_PICKUP, type: 'primary' });
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
      {/* 新订单横幅通知（支付成功 order:new） */}
      {newOrderBanner && newOrderBanner.visible && (
        <View className='new-order-banner'>
          <View className='new-order-banner__body'>
            <View className='new-order-banner__header'>
              <View className='new-order-banner__icon'><Icon name='bell' size={22} color='#FFFFFF' /></View>
              <View className='new-order-banner__titles'>
                <Text className='new-order-banner__text'>新待接订单</Text>
                <Text className='new-order-banner__meta'>
                  {DELIVERY_TYPE_MAP[newOrderBanner.deliveryType] || newOrderBanner.deliveryType || '订单'}
                  {newOrderBanner.itemCount > 0 ? ` · ${newOrderBanner.itemCount}件` : ''}
                  {' · '}
                  {getBannerLocationSummary(newOrderBanner)}
                </Text>
              </View>
              <Text className='new-order-banner__amount'>
                {formatPriceWithSymbol(newOrderBanner.total)}
              </Text>
              <View
                className='new-order-banner__close'
                onClick={(e) => {
                  e.stopPropagation();
                  closeNewOrderBanner();
                }}
              >
                <Icon name='close' size={14} color='#FFFFFF' />
              </View>
            </View>
            <View className='new-order-banner__actions'>
              <View
                className='new-order-banner__btn new-order-banner__btn--ghost'
                onClick={handleBannerViewOrder}
              >
                <Text className='new-order-banner__btn-text'>查看</Text>
              </View>
              <View
                className={`new-order-banner__btn new-order-banner__btn--solid${
                  statusAction.isPending(`${newOrderBanner.orderId}:${OrderStatus.ACCEPTED}`)
                    ? ' new-order-banner__btn--disabled'
                    : ''
                }`}
                onClick={handleBannerAcceptOrder}
              >
                <Text className='new-order-banner__btn-text new-order-banner__btn-text--solid'>
                  {statusAction.isPending(`${newOrderBanner.orderId}:${OrderStatus.ACCEPTED}`)
                    ? '接单中...'
                    : '一键接单'}
                </Text>
              </View>
            </View>
          </View>
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
        <View
          className={`stat-card${paidPendingCount > 0 ? ' stat-card--alert' : ''}`}
          onClick={() => switchTab(OrderStatus.PAID)}
        >
          <Text className='stat-card__value'>{paidPendingCount || stats?.pendingCount || 0}</Text>
          <Text className='stat-card__label'>待接单</Text>
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
          <View className='action-btn__icon'><Icon name='menu' size={16} color='#FF6B35' /></View>
          <Text>菜品管理</Text>
        </View>
        <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/admin/user-manage' })}>
          <View className='action-btn__icon'><Icon name='users' size={16} color='#FF6B35' /></View>
          <Text>会员管理</Text>
        </View>
        <View className='action-btn' onClick={() => Taro.navigateTo({ url: '/pages/admin/reviews' })}>
          <View className='action-btn__icon'><Icon name='star' size={16} color='#FF6B35' /></View>
          <Text>评价列表</Text>
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
            <View className='empty-state__icon-wrap'>
              <Icon name='order' size={40} color='#CCCCCC' />
            </View>
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
                      {shortOrderId(order.id, order.orderNo)}
                    </Text>
                    <Text
                      className='order-card__status-tag'
                      style={{
                        color: statusStyle.color,
                        background: statusStyle.background,
                      }}
                    >
                      {getOrderStatusLabel(order.status, order.deliveryType)}
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

        <ListEndTip
          loading={loadingMore}
          hasMore={hasMore}
          show={allOrders.length > 0}
        />
      </ScrollView>

      {/* 操作弹窗 */}
      {modalVisible && selectedOrder && (
        <View
          className='action-modal'
          onClick={closeActionModal}
        >
          <View
            className='action-modal__content'
            onClick={(e) => e.stopPropagation()}
          >
            <View className='action-modal__header'>
              <Text className='action-modal__title'>
                订单 {shortOrderId(selectedOrder.id, selectedOrder.orderNo)}
              </Text>
              <View
                className='action-modal__close'
                onClick={closeActionModal}
              >
                <Icon name='close' size={16} color='#999999' />
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
                  {getOrderStatusLabel(selectedOrder.status, selectedOrder.deliveryType)}
                </Text>
              </View>
              {!!getMerchantOrderActionHint(selectedOrder.status, selectedOrder.deliveryType) && (
                <View className='action-modal__info-row'>
                  <Text className='action-modal__info-label'>下一步</Text>
                  <Text className='action-modal__info-value'>
                    {getMerchantOrderActionHint(selectedOrder.status, selectedOrder.deliveryType)}
                  </Text>
                </View>
              )}
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
              {selectedOrder.invoiceNeeded && (
                <View className='action-modal__info-row'>
                  <Text className='action-modal__info-label'>发票</Text>
                  <Text className='action-modal__info-value'>
                    需要开票
                    {selectedOrder.invoiceTitle ? ` · ${selectedOrder.invoiceTitle}` : ''}
                    {selectedOrder.invoiceTaxNo ? ` · 税号${selectedOrder.invoiceTaxNo}` : ''}
                  </Text>
                </View>
              )}
              <View className='action-modal__info-row'>
                <Text className='action-modal__info-label'>时间</Text>
                <Text className='action-modal__info-value'>
                  {formatTime(selectedOrder.createdAt, 'MM-DD HH:mm')}
                </Text>
              </View>

              {/* 骑手实时位置：仅外卖配送中订单 */}
              {selectedOrder.deliveryType === DeliveryType.DELIVERY
                && selectedOrder.status === OrderStatus.DELIVERING ? (
                <RiderTrackMap
                  className='action-modal__rider-map'
                  track={deliveryTrack}
                  shopPoint={toMapPoint(selectedOrder.shopLatitude, selectedOrder.shopLongitude)}
                  customerPoint={toMapPoint(
                    selectedOrder.deliveryLatitude,
                    selectedOrder.deliveryLongitude,
                  )}
                  riderDeliveryCount={riderDeliveryCount}
                  loading={trackLoading}
                  requireTrack
                  emptyText=''
                  pendingText='骑手尚未上报位置'
                />
              ) : null}

              {/* 操作按钮 */}
              {(selectedOrder.cancelReason || selectedOrder.rejectReason) && (
                <View className='action-modal__info-row'>
                  <Text className='action-modal__info-label'>
                    {selectedOrder.rejectReason ? '拒单原因' : '取消原因'}
                  </Text>
                  <Text className='action-modal__info-value action-modal__info-value--danger'>
                    {selectedOrder.rejectReason || selectedOrder.cancelReason}
                  </Text>
                </View>
              )}

              {/* 操作按钮 */}
              <View className='action-modal__actions'>
                {getAvailableActions(selectedOrder).map((action) => {
                  const actionPending = statusAction.isPending(
                    `${selectedOrder.id}:${action.nextStatus}`,
                  );
                  return (
                    <View
                      key={action.nextStatus}
                      className={`action-modal__btn action-modal__btn--${action.type}${
                        actionPending ? ' action-modal__btn--disabled' : ''
                      }`}
                      onClick={() => {
                        if (action.nextStatus === OrderStatus.REJECTED) {
                          openReasonSheet(selectedOrder.id, 'reject');
                          return;
                        }
                        if (action.nextStatus === OrderStatus.CANCELLED) {
                          openReasonSheet(selectedOrder.id, 'cancel');
                          return;
                        }
                        updateOrderStatus(selectedOrder.id, action.nextStatus as OrderStatus);
                      }}
                    >
                      {actionPending ? '处理中...' : action.label}
                    </View>
                  );
                })}
                <View
                  className='action-modal__btn action-modal__btn--secondary'
                  onClick={closeActionModal}
                >
                  关闭
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      <BottomSheet
        visible={reasonSheetVisible}
        onClose={() => !reasonSubmitting && setReasonSheetVisible(false)}
        title={reasonMode === 'reject' ? '拒单原因' : '取消原因'}
        showClose
      >
        <View className='reason-sheet'>
          <Text className='reason-sheet__hint'>
            {reasonMode === 'reject'
              ? '请填写拒单原因（必填，至少 2 个字）'
              : '请填写取消原因（必填，至少 2 个字）'}
          </Text>
          <Textarea
            className='reason-sheet__textarea'
            value={reasonText}
            maxlength={200}
            placeholder={reasonMode === 'reject' ? '请填写拒单原因...' : '请填写取消原因...'}
            onInput={(e) => setReasonText(e.detail.value)}
            disabled={reasonSubmitting}
          />
          <View className='reason-sheet__btns'>
            <View
              className={`reason-sheet__btn reason-sheet__btn--cancel ${reasonSubmitting ? 'disabled' : ''}`}
              onClick={() => !reasonSubmitting && setReasonSheetVisible(false)}
            >
              再想想
            </View>
            <View
              className={`reason-sheet__btn reason-sheet__btn--danger ${reasonSubmitting || !reasonText.trim() ? 'disabled' : ''}`}
              onClick={() => !reasonSubmitting && submitReasonAction()}
            >
              {reasonSubmitting
                ? '提交中...'
                : reasonMode === 'reject'
                  ? '确认拒单'
                  : '确认取消'}
            </View>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
};

export default AdminPage;
