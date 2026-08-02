import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Textarea, Image, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { get, post, isDuplicateSubmitError } from '../../utils/request';
import { useAuthStore } from '../../stores/authStore';
import { useAsyncAction, useKeyedAsyncAction } from '../../hooks/useAsyncAction';
import { formatPriceWithSymbol, formatTime, formatRelativeTime, shortOrderId, pickupCode } from '../../utils/format';
import { ORDER_STATUS_COLOR_MAP, DELIVERY_TYPE_MAP, getOrderStatusLabel, getMerchantOrderActionHint, getMerchantAfterSaleLabel } from '../../utils/constants';
import { DeliveryTrackPoint, DeliveryType, Order, OrderStatus } from '../../types/order';
import { getOrderStatusActions, type OrderStatusAction } from '@taste-food/shared/types';
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
import { useSyncTabBar } from '../../hooks/useSyncTabBar';
import { TAB_BAR_PATHS } from '../../utils/tab-bar';

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
  { key: OrderStatus.READY_FOR_DELIVERY, label: '待骑手' },
  { key: OrderStatus.READY_FOR_PICKUP, label: '待取餐' },
  { key: OrderStatus.DELIVERING, label: '配送中' },
  { key: 'refund', label: '退款售后' },
  { key: OrderStatus.COMPLETED, label: '已完成' },
  { key: OrderStatus.CANCELLED, label: '已取消' },
  { key: OrderStatus.REJECTED, label: '已拒单' },
];

/** 接单预计出餐分钟预设 */
const ETA_PRESETS = [15, 20, 30];

/** T246.1 商家一键拨打顾客电话 */
function callCustomer(phone?: string) {
  if (!phone) return;
  Taro.makePhoneCall({ phoneNumber: phone }).catch(() => {
    Taro.showToast({ title: '拨打失败', icon: 'none' });
  });
}

const AdminPage = () => {
  useSyncTabBar(TAB_BAR_PATHS.admin);
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
  const [reasonMode, setReasonMode] = useState<'reject' | 'cancel' | 'force' | 'cancel_request_reject'>('reject');
  const [reasonText, setReasonText] = useState('');
  const [pendingActionOrderId, setPendingActionOrderId] = useState<string | null>(null);
  const [etaSheetVisible, setEtaSheetVisible] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(20);
  const [etaCustom, setEtaCustom] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const shopId = DEFAULT_SHOP_ID;
  const [newOrderBanner, setNewOrderBanner] = useState<NewOrderBannerData | null>(null);
  const [deliveryTrack, setDeliveryTrack] = useState<DeliveryTrackPoint[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [riderDeliveryCount, setRiderDeliveryCount] = useState<number | undefined>(undefined);
  const [paidPendingCount, setPaidPendingCount] = useState(0);
  /** 售后待处理（取消申请中）数量，用于退款售后 Tab 角标 */
  const [cancelRequestCount, setCancelRequestCount] = useState(0);
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
    pullCancelRequestCount();
  };

  // 保持 loadData 的最新引用，供 socket 回调调用（避免闭包过期）
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  /** 回到前台时补拉 paid 待接单数量（不强制切换当前 Tab 列表） */
  /** 拉取售后待处理数量（cancel_requested_at 非空） */
  const pullCancelRequestCount = useCallback(async () => {
    try {
      const response = await get<PaginatedData<Order>>('/orders', {
        shop_id: shopId,
        status: 'cancel_request',
        page: 1,
        pageSize: 1,
      }, { showError: false, useCache: false });
      setCancelRequestCount(response.data?.total || 0);
    } catch (error) {
      console.error('加载售后待处理数量失败:', error);
    }
  }, [shopId]);

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

  /** 横幅一键接单：打开预计出餐分钟弹层 */
  const handleBannerAcceptOrder = () => {
    const orderId = newOrderBanner?.orderId;
    if (!orderId) return;
    closeNewOrderBanner();
    openEtaSheet(orderId);
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

  /** 操作成功后统一收尾：关弹层 + 刷新 */
  const afterOrderActionSuccess = (toastTitle: string) => {
    Taro.showToast({ title: toastTitle, icon: 'success' });
    setReasonSheetVisible(false);
    setReasonText('');
    setEtaSheetVisible(false);
    setEtaCustom('');
    setEtaMinutes(20);
    setPendingActionOrderId(null);
    closeActionModal();
    setSelectedOrder(null);
    loadOrders(1);
    loadStats();
    pullPaidPendingOrders();
    pullCancelRequestCount();
  };

  /** 更新订单状态（可附带 estimatedMinutes / reason） */
  const updateOrderStatus = (
    orderId: string,
    status: OrderStatus,
    extra?: { reason?: string; estimatedMinutes?: number },
  ) =>
    statusAction.run(`${orderId}:${status}`, async () => {
      try {
        const body: Record<string, unknown> = { status };
        if (extra?.reason) body.reason = extra.reason;
        if (typeof extra?.estimatedMinutes === 'number' && extra.estimatedMinutes > 0) {
          body.estimatedMinutes = extra.estimatedMinutes;
        }
        await post(`/orders/${orderId}/status`, body);
        afterOrderActionSuccess(status === OrderStatus.REJECTED ? '已拒单' : '操作成功');
      } catch (error: any) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(error)) return;
        console.error('操作失败:', error);
      }
    });

  /** 打开拒单/取消/强制完成/拒绝取消申请原因弹层 */
  const openReasonSheet = (
    orderId: string,
    mode: 'reject' | 'cancel' | 'force' | 'cancel_request_reject',
  ) => {
    setPendingActionOrderId(orderId);
    setReasonMode(mode);
    setReasonText('');
    setReasonSheetVisible(true);
  };

  /** 打开接单预计分钟弹层 */
  const openEtaSheet = (orderId: string) => {
    setPendingActionOrderId(orderId);
    setEtaMinutes(20);
    setEtaCustom('');
    setEtaSheetVisible(true);
  };

  /** 提交接单（可选预计分钟） */
  const submitAcceptWithEta = (skipEta = false) => {
    if (!pendingActionOrderId) return;
    let minutes: number | undefined;
    if (!skipEta) {
      if (etaCustom.trim()) {
        const parsed = Number(etaCustom.trim());
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 180) {
          Taro.showToast({ title: '请输入 1-180 的分钟数', icon: 'none' });
          return;
        }
        minutes = Math.round(parsed);
      } else if (typeof etaMinutes === 'number' && etaMinutes > 0) {
        minutes = etaMinutes;
      }
    }
    return updateOrderStatus(pendingActionOrderId, OrderStatus.ACCEPTED, {
      estimatedMinutes: minutes,
    });
  };

  /** 处理顾客取消申请（同意将关单并尝试退款） */
  const resolveCancelRequest = async (
    orderId: string,
    approve: boolean,
    reason?: string,
  ) => {
    const run = () =>
      statusAction.run(`${orderId}:cancel-request:${approve ? 'approve' : 'reject'}`, async () => {
        try {
          const body: Record<string, unknown> = { approve };
          if (reason) body.reason = reason;
          await post(`/orders/${orderId}/cancel-request/resolve`, body);
          afterOrderActionSuccess(approve ? '已同意取消并退款' : '已拒绝取消申请');
        } catch (error: any) {
          if (isDuplicateSubmitError(error)) return;
          console.error('处理取消申请失败:', error);
        }
      });

    if (!approve) {
      return run();
    }

    const target = allOrders.find((o) => o.id === orderId) || selectedOrder;
    const amountText = target ? formatPriceWithSymbol(target.total) : '';
    const confirmed = await new Promise<boolean>((resolve) => {
      Taro.showModal({
        title: '同意取消并退款？',
        content: amountText
          ? `同意后订单将关闭，已支付金额 ${amountText} 将原路退回顾客。`
          : '同意后订单将关闭，如已支付将原路退回顾客。',
        confirmText: '同意退款',
        confirmColor: '#FF6B35',
        success: (res) => resolve(!!res.confirm),
        fail: () => resolve(false),
      });
    });
    if (!confirmed) return;
    return run();
  };

  /** 提交拒单/取消原因 */
  const submitReasonAction = () => {
    if (!pendingActionOrderId) return;
    const reason = reasonText.trim();
    // 拒绝取消申请时原因可选
    if (reasonMode !== 'cancel_request_reject') {
      if (!reason) {
        Taro.showToast({
          title:
            reasonMode === 'reject'
              ? '请填写拒单原因'
              : reasonMode === 'force'
                ? '请填写强制完成原因'
                : '请填写取消原因',
          icon: 'none',
        });
        return;
      }
      if (reason.length < 2) {
        Taro.showToast({ title: '原因至少 2 个字', icon: 'none' });
        return;
      }
    }

    return runReasonSubmit(async () => {
      try {
        if (reasonMode === 'reject') {
          await updateOrderStatus(pendingActionOrderId, OrderStatus.REJECTED, { reason });
        } else if (reasonMode === 'force') {
          await post(`/orders/${pendingActionOrderId}/force-complete`, { reason });
          afterOrderActionSuccess('已强制完成');
        } else if (reasonMode === 'cancel_request_reject') {
          await resolveCancelRequest(pendingActionOrderId, false, reason || undefined);
        } else {
          await post(`/orders/${pendingActionOrderId}/cancel`, { reason });
          afterOrderActionSuccess('订单已取消');
        }
      } catch (error: any) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(error)) return;
        console.error('提交原因失败:', error);
      }
    });
  };

  /** 点击状态操作按钮 */
  const handleStatusActionClick = (order: Order, action: OrderStatusAction) => {
    if (action.cancel) {
      openReasonSheet(order.id, 'cancel');
      return;
    }
    if (action.status === OrderStatus.REJECTED) {
      openReasonSheet(order.id, 'reject');
      return;
    }
    if (action.forceComplete) {
      openReasonSheet(order.id, 'force');
      return;
    }
    if (action.acceptWithEta) {
      openEtaSheet(order.id);
      return;
    }
    updateOrderStatus(order.id, action.status as OrderStatus);
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

    // 已完成外送单补拉详情，带出送达凭证
    if (
      order.deliveryType === DeliveryType.DELIVERY &&
      order.status === OrderStatus.COMPLETED
    ) {
      get<Order>(`/orders/${order.id}`, undefined, { useCache: false, showError: false })
        .then((res) => {
          if (res.data) setSelectedOrder(res.data);
        })
        .catch(() => {
          /* 列表数据仍可展示 */
        });
    }
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
        {TABS.map((tab) => {
          const badge =
            tab.key === 'refund' && cancelRequestCount > 0
              ? cancelRequestCount
              : tab.key === OrderStatus.PAID && paidPendingCount > 0
                ? paidPendingCount
                : 0;
          return (
            <View
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'tab-item--active' : ''}`}
              onClick={() => switchTab(tab.key)}
            >
              <Text>{tab.label}</Text>
              {badge > 0 ? (
                <Text className='tab-item__count tab-item__count--alert'>
                  {badge > 99 ? '99+' : badge}
                </Text>
              ) : null}
            </View>
          );
        })}
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
                  className={`order-card${(order.urgeCount || 0) > 0 ? ' order-card--urged' : ''}${
                    order.cancelRequestedAt ? ' order-card--cancel-request' : ''
                  }`}
                  onClick={() => openActionModal(order)}
                >
                  <View className='order-card__header'>
                    <Text className='order-card__id'>
                      {shortOrderId(order.id, order.orderNo)}
                    </Text>
                    <Text
                      className='order-card__status-tag'
                      style={{
                        color: order.cancelRequestedAt
                          ? (ORDER_STATUS_COLOR_MAP[OrderStatus.PENDING_PAYMENT] || statusStyle.color)
                          : statusStyle.color,
                        background: order.cancelRequestedAt
                          ? `${ORDER_STATUS_COLOR_MAP[OrderStatus.PENDING_PAYMENT] || statusStyle.color}18`
                          : statusStyle.background,
                      }}
                    >
                      {getMerchantAfterSaleLabel({
                        status: order.status,
                        cancelRequestedAt: order.cancelRequestedAt,
                      }) || getOrderStatusLabel(order.status, order.deliveryType)}
                    </Text>
                  </View>
                  {/* T246.5 待取餐的自取单在列表直出取餐码，便于店员叫号核对 */}
                  {order.deliveryType === DeliveryType.PICKUP
                    && order.status === OrderStatus.READY_FOR_PICKUP
                    && pickupCode(order.id, order.orderNo) ? (
                    <View className='order-card__pickup'>
                      <Text className='order-card__pickup-label'>取餐码</Text>
                      <Text className='order-card__pickup-code'>
                        {pickupCode(order.id, order.orderNo)}
                      </Text>
                    </View>
                  ) : null}
                  <View className='order-card__items'>
                    {order.items.slice(0, 3).map((item) => (
                      <Text key={item.id} className='order-card__item'>
                        {item.name} x{item.quantity}
                      </Text>
                    ))}
                    {order.items.length > 3 && (
                      <Text className='order-card__item order-card__item--more'>
                        等 {order.items.length} 件商品
                      </Text>
                    )}
                  </View>
                  {((order.urgeCount || 0) > 0 || order.cancelRequestedAt) && (
                    <View className='order-card__flags'>
                      {(order.urgeCount || 0) > 0 && (
                        <Text className='order-card__flag order-card__flag--urge'>
                          催单 x{order.urgeCount}
                          {order.lastUrgedAt ? ` · ${formatRelativeTime(order.lastUrgedAt)}` : ''}
                        </Text>
                      )}
                      {order.cancelRequestedAt && (
                        <Text className='order-card__flag order-card__flag--cancel'>
                          售后待处理
                          {order.cancelRequestReason ? ` · ${order.cancelRequestReason}` : ''}
                        </Text>
                      )}
                    </View>
                  )}
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
              {(selectedOrder.urgeCount || 0) > 0 && (
                <View className='action-modal__alert action-modal__alert--urge'>
                  <Text className='action-modal__alert-title'>
                    顾客已催单 x{selectedOrder.urgeCount}
                  </Text>
                  {selectedOrder.lastUrgedAt && (
                    <Text className='action-modal__alert-desc'>
                      最近催单：{formatRelativeTime(selectedOrder.lastUrgedAt)}（{formatTime(selectedOrder.lastUrgedAt, 'HH:mm')}）
                    </Text>
                  )}
                </View>
              )}

              {selectedOrder.cancelRequestedAt && (
                <View className='action-modal__alert action-modal__alert--cancel'>
                  <Text className='action-modal__alert-title'>退款售后 · 顾客申请取消</Text>
                  <Text className='action-modal__alert-desc'>
                    {formatRelativeTime(selectedOrder.cancelRequestedAt)}
                    {selectedOrder.cancelRequestReason
                      ? ` · ${selectedOrder.cancelRequestReason}`
                      : ''}
                  </Text>
                  <Text className='action-modal__alert-tip'>
                    同意后订单关闭，已支付 {formatPriceWithSymbol(selectedOrder.total)} 将原路退回
                  </Text>
                  <View className='action-modal__alert-actions'>
                    <View
                      className={`action-modal__alert-btn action-modal__alert-btn--approve${
                        statusAction.isPending(`${selectedOrder.id}:cancel-request:approve`)
                          ? ' action-modal__alert-btn--disabled'
                          : ''
                      }`}
                      onClick={() => resolveCancelRequest(selectedOrder.id, true)}
                    >
                      {statusAction.isPending(`${selectedOrder.id}:cancel-request:approve`)
                        ? '处理中...'
                        : '同意并退款'}
                    </View>
                    <View
                      className={`action-modal__alert-btn action-modal__alert-btn--reject${
                        statusAction.isPending(`${selectedOrder.id}:cancel-request:reject`)
                          ? ' action-modal__alert-btn--disabled'
                          : ''
                      }`}
                      onClick={() => openReasonSheet(selectedOrder.id, 'cancel_request_reject')}
                    >
                      拒绝申请
                    </View>
                  </View>
                </View>
              )}

              {/* T246.5 取餐码：自取订单核对用，字号放大 */}
              {selectedOrder.deliveryType === DeliveryType.PICKUP
                && pickupCode(selectedOrder.id, selectedOrder.orderNo) ? (
                <View className='action-modal__pickup-code'>
                  <Text className='action-modal__pickup-code-label'>取餐码</Text>
                  <Text className='action-modal__pickup-code-value'>
                    {pickupCode(selectedOrder.id, selectedOrder.orderNo)}
                  </Text>
                </View>
              ) : null}

              <View className='action-modal__info-row'>
                <Text className='action-modal__info-label'>配送方式</Text>
                <Text className='action-modal__info-value'>
                  {DELIVERY_TYPE_MAP[selectedOrder.deliveryType] || selectedOrder.deliveryType}
                  {selectedOrder.tableNo ? ` · 桌号 ${selectedOrder.tableNo}` : ''}
                </Text>
              </View>
              {/* T246.1 联系人 + 一键拨号 */}
              {selectedOrder.contactName ? (
                <View className='action-modal__info-row'>
                  <Text className='action-modal__info-label'>联系人</Text>
                  <Text className='action-modal__info-value'>{selectedOrder.contactName}</Text>
                </View>
              ) : null}
              {selectedOrder.contactPhone ? (
                <View className='action-modal__info-row'>
                  <Text className='action-modal__info-label'>手机号</Text>
                  <View className='action-modal__contact'>
                    <Text className='action-modal__info-value'>{selectedOrder.contactPhone}</Text>
                    <View
                      className='action-modal__call-btn'
                      onClick={() => callCustomer(selectedOrder.contactPhone)}
                    >
                      <Text className='action-modal__call-btn-text'>拨打</Text>
                    </View>
                  </View>
                </View>
              ) : null}
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

              {/* 送达凭证：已完成外送单 */}
              {selectedOrder.deliveryType === DeliveryType.DELIVERY
                && selectedOrder.deliveryProof ? (
                <View className='action-modal__proof'>
                  <View className='action-modal__info-row'>
                    <Text className='action-modal__info-label'>送达凭证</Text>
                    <Text className='action-modal__info-value'>
                      {formatTime(selectedOrder.deliveryProof.deliveredAt, 'MM-DD HH:mm')}
                      {selectedOrder.deliveryProof.forceReason
                        ? ` · 强制完成：${selectedOrder.deliveryProof.forceReason}`
                        : typeof selectedOrder.deliveryProof.confirmDistanceM === 'number'
                          ? ` · 距收货点 ${Math.round(selectedOrder.deliveryProof.confirmDistanceM)} 米`
                          : ''}
                    </Text>
                  </View>
                  {selectedOrder.deliveryProof.photos?.length ? (
                    <View className='action-modal__proof-photos'>
                      {selectedOrder.deliveryProof.photos.map((photo, idx) => (
                        <Image
                          key={`${photo.url}-${idx}`}
                          className='action-modal__proof-photo'
                          src={photo.url}
                          mode='aspectFill'
                          onClick={() => {
                            Taro.previewImage({
                              current: photo.url,
                              urls: selectedOrder.deliveryProof!.photos.map((p) => p.url),
                            });
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
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
                {getOrderStatusActions(selectedOrder.status, selectedOrder.deliveryType).map((action) => {
                  const actionPending = statusAction.isPending(
                    `${selectedOrder.id}:${action.status}`,
                  );
                  return (
                    <View
                      key={`${action.status}:${action.label}`}
                      className={`action-modal__btn action-modal__btn--${action.type}${
                        actionPending ? ' action-modal__btn--disabled' : ''
                      }`}
                      onClick={() => handleStatusActionClick(selectedOrder, action)}
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
        title={
          reasonMode === 'reject'
            ? '拒单原因'
            : reasonMode === 'force'
              ? '强制完成原因'
              : reasonMode === 'cancel_request_reject'
                ? '拒绝取消申请'
                : '取消原因'
        }
        showClose
      >
        <View className='reason-sheet'>
          <Text className='reason-sheet__hint'>
            {reasonMode === 'reject'
              ? '请填写拒单原因（必填，至少 2 个字）。如已支付将原路退款。'
              : reasonMode === 'force'
                ? '骑手无法正常送达时可用。将跳过定位与拍照，原因会展示给顾客并记入审计。'
                : reasonMode === 'cancel_request_reject'
                  ? '可填写拒绝原因（选填），将通知顾客申请未通过，订单继续履约。'
                  : '请填写取消原因（必填，至少 2 个字）。关单后如已支付将原路退款。'}
          </Text>
          <Textarea
            className='reason-sheet__textarea'
            value={reasonText}
            maxlength={200}
            placeholder={
              reasonMode === 'reject'
                ? '请填写拒单原因...'
                : reasonMode === 'force'
                  ? '例如：顾客要求放门口 / 骑手定位异常...'
                  : reasonMode === 'cancel_request_reject'
                    ? '例如：餐品已制作完成，暂无法取消...'
                    : '请填写取消原因...'
            }
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
              className={`reason-sheet__btn reason-sheet__btn--danger ${
                reasonSubmitting ||
                (reasonMode !== 'cancel_request_reject' && !reasonText.trim())
                  ? 'disabled'
                  : ''
              }`}
              onClick={() => !reasonSubmitting && submitReasonAction()}
            >
              {reasonSubmitting
                ? '提交中...'
                : reasonMode === 'reject'
                  ? '确认拒单退款'
                  : reasonMode === 'force'
                    ? '确认强制完成'
                    : reasonMode === 'cancel_request_reject'
                      ? '确认拒绝'
                      : '确认取消退款'}
            </View>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={etaSheetVisible}
        onClose={() => {
          if (statusAction.isPending(`${pendingActionOrderId || ''}:${OrderStatus.ACCEPTED}`)) return;
          setEtaSheetVisible(false);
        }}
        title='预计出餐时间'
        showClose
      >
        <View className='eta-sheet'>
          <Text className='eta-sheet__hint'>接单时可告知顾客预计出餐分钟（可选）</Text>
          <View className='eta-sheet__presets'>
            {ETA_PRESETS.map((m) => (
              <View
                key={m}
                className={`eta-sheet__chip${etaMinutes === m && !etaCustom.trim() ? ' eta-sheet__chip--active' : ''}`}
                onClick={() => {
                  setEtaMinutes(m);
                  setEtaCustom('');
                }}
              >
                <Text>{m} 分钟</Text>
              </View>
            ))}
          </View>
          <View className='eta-sheet__custom'>
            <Text className='eta-sheet__custom-label'>自定义</Text>
            <Input
              className='eta-sheet__input'
              type='number'
              value={etaCustom}
              placeholder='输入分钟数'
              maxlength={3}
              onInput={(e) => {
                setEtaCustom(e.detail.value);
                setEtaMinutes(null);
              }}
            />
            <Text className='eta-sheet__custom-unit'>分钟</Text>
          </View>
          <View className='eta-sheet__btns'>
            <View
              className={`eta-sheet__btn eta-sheet__btn--ghost${
                statusAction.isPending(`${pendingActionOrderId || ''}:${OrderStatus.ACCEPTED}`)
                  ? ' disabled'
                  : ''
              }`}
              onClick={() => submitAcceptWithEta(true)}
            >
              不填，直接接单
            </View>
            <View
              className={`eta-sheet__btn eta-sheet__btn--primary${
                statusAction.isPending(`${pendingActionOrderId || ''}:${OrderStatus.ACCEPTED}`)
                  ? ' disabled'
                  : ''
              }`}
              onClick={() => submitAcceptWithEta(false)}
            >
              {statusAction.isPending(`${pendingActionOrderId || ''}:${OrderStatus.ACCEPTED}`)
                ? '接单中...'
                : '确认接单'}
            </View>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
};

export default AdminPage;
