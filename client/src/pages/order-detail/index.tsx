import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Textarea, Map as TaroMap, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post, isRetryableError, isDuplicateSubmitError } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol, formatTime, shortOrderId } from '../../utils/format';
import {
  DELIVERY_TYPE_MAP,
  getOrderStatusLabel,
  getCustomerOrderStatusHint,
  getCustomerAfterSaleTitle,
  getCustomerAfterSaleHint,
  buildAfterSaleSteps,
  PAYMENT_TIMEOUT_MINUTES,
  ORDER_URGE_COOLDOWN_MINUTES,
  CUSTOMER_CANCELLABLE_STATUSES,
  CUSTOMER_CANCEL_REQUESTABLE_STATUSES,
} from '../../utils/constants';
import AfterSalePanel from '../../components/AfterSalePanel';
import {
  DeliveryTrackPoint,
  Order,
  OrderStatus,
  DeliveryType,
  OrderStatusHistoryItem,
} from '../../types/order';
import { onDeliveryTrackUpdated, onOrderUpdated, removePageListeners } from '../../services/socket';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import FoodThumb from '../../components/FoodThumb';
import StatusTimeline from '../../components/StatusTimeline';
import SkeletonLoader from '../../components/SkeletonLoader';
import Icon from '../../components/Icon';
import EmptyState from '../../components/EmptyState';
import BottomSheet from '../../components/BottomSheet';
import FooterBar from '../../components/FooterBar';
import orderActiveIcon from '../../assets/icons/order-active.png';
import './index.scss';

type MapPoint = {
  latitude: number;
  longitude: number;
};

/** 全屏配送地图 id：用 MapContext.includePoints 做一次性适配，避免 prop 持续回拉视口 */
const FULLSCREEN_MAP_ID = 'order-detail-fullscreen-map';
const MAP_FIT_PADDING = [120, 64, 100, 64];

const URGEABLE_STATUSES: OrderStatus[] = [
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.READY_FOR_PICKUP,
];

function formatPayCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function callPhone(phone?: string) {
  if (!phone) return;
  Taro.makePhoneCall({ phoneNumber: phone }).catch(() => {
    Taro.showToast({ title: '拨打失败', icon: 'none' });
  });
}

/** T246.4 门店导航：有坐标才唤起地图，无坐标由调用方降级为复制地址 */
function openShopLocation(order: Order) {
  const latitude = Number(order.shopLatitude);
  const longitude = Number(order.shopLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  Taro.openLocation({
    latitude,
    longitude,
    name: order.shopName || '门店',
    address: order.shopAddress || '',
    scale: 18,
  }).catch(() => {
    Taro.showToast({ title: '打开地图失败', icon: 'none' });
  });
}

/** T246.4 无坐标时的降级：复制地址到剪贴板 */
function copyShopAddress(address?: string) {
  if (!address) return;
  Taro.setClipboardData({ data: address })
    .then(() => {
      Taro.showToast({ title: '地址已复制', icon: 'success' });
    })
    .catch(() => {
      Taro.showToast({ title: '复制失败', icon: 'none' });
    });
}

const OrderDetailPage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const clearCart = useCartStore((s) => s.clearCart);
  const addItem = useCartStore((s) => s.addItem);
  const userRole = useAuthStore((s) => s.user?.role);
  const currentUserId = useAuthStore((s) => s.user?.userId);

  // 本地状态
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [deliveryFee] = useState(0);
  const [deliveryTrack, setDeliveryTrack] = useState<DeliveryTrackPoint[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [review, setReview] = useState<{
    id: string;
    orderId: string;
    rating: number;
    content: string;
    replyContent?: string;
    replyAt?: string;
    createdAt: string;
  } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [goodsExpanded, setGoodsExpanded] = useState(false);
  const [reviewSheetVisible, setReviewSheetVisible] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [cancelSheetVisible, setCancelSheetVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelMode, setCancelMode] = useState<'cancel' | 'request'>('cancel');
  const [payRemainSec, setPayRemainSec] = useState<number | null>(null);
  const [payment, setPayment] = useState<{
    transactionId: string;
    orderId: string;
    amount: number;
    status: string;
    paidAt?: string;
    provider?: string;
  } | null>(null);
  const [paymentLoaded, setPaymentLoaded] = useState(false);
  // §3.23 / T246.9 二维码放大查看
  const [qrExpanded, setQrExpanded] = useState(false);

  // 写操作强守卫（ref 判定，可挡同一 tick 内的连点，避免重复支付/重复退款/重复评价）
  const payAction = useAsyncAction();
  const cancelAction = useAsyncAction();
  const reviewAction = useAsyncAction();
  const reorderAction = useAsyncAction();
  const urgeAction = useAsyncAction();

  // orderId 跨渲染持久化（不触发重渲染）
  const orderIdRef = useRef<string>('');
  // 全屏地图适配点（render 期写入，供 MapContext 一次性 includePoints）
  const mapIncludePointsRef = useRef<MapPoint[]>([]);
  // 进入全屏时冻结中心，避免父组件重渲染把用户缩放/拖动拉回
  const fullscreenCenterRef = useRef<MapPoint>({ latitude: 28.682, longitude: 115.8579 });
  const [fullscreenCenter, setFullscreenCenter] = useState<MapPoint>({
    latitude: 28.682,
    longitude: 115.8579,
  });

  /** 一次性把全屏地图适配到起终点/轨迹，不持续绑定 includePoints prop */
  const fitFullscreenRoute = useCallback((retry = 0) => {
    const points = mapIncludePointsRef.current;
    if (!points.length) return;
    try {
      const ctx = Taro.createMapContext(FULLSCREEN_MAP_ID);
      ctx.includePoints({
        points,
        padding: MAP_FIT_PADDING,
      });
    } catch (error) {
      if (retry < 3) {
        setTimeout(() => fitFullscreenRoute(retry + 1), 180);
        return;
      }
      console.warn('全屏地图适配路线失败:', error);
    }
  }, []);

  /** 加载配送轨迹 */
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

  /** 加载订单评价（仅 completed 时有意义） */
  const loadReview = async (orderId: string) => {
    setReviewLoading(true);
    try {
      const res = await get<{
        id: string;
        orderId: string;
        rating: number;
        content: string;
        replyContent?: string;
        replyAt?: string;
        createdAt: string;
      } | null>(`/orders/${orderId}/reviews`, undefined, { useCache: false, showError: false });
      setReview(res.data || null);
    } catch (error) {
      console.error('加载评价失败:', error);
      setReview(null);
    } finally {
      setReviewLoading(false);
    }
  };

  /** 加载支付/退款记录（售后进度用） */
  const loadPayment = async (orderId: string) => {
    setPaymentLoaded(false);
    try {
      const res = await get<{
        transactionId: string;
        orderId: string;
        amount: number;
        status: string;
        paidAt?: string;
        provider?: string;
      } | null>(`/orders/${orderId}/payment`, undefined, {
        useCache: false,
        showError: false,
      });
      setPayment(res.data || null);
    } catch (error) {
      console.error('加载支付记录失败:', error);
      setPayment(null);
    } finally {
      setPaymentLoaded(true);
    }
  };

  /** 加载订单详情 */
  const loadOrder = async (orderId: string) => {
    setLoading(true);
    setLoadError(false);
    setCanRetry(false);
    try {
      const response = await get<Order>(`/orders/${orderId}`);
      setOrder(response.data);
      setLoading(false);
      if (response.data?.deliveryType === DeliveryType.DELIVERY) {
        loadDeliveryTrack(orderId);
      } else {
        setDeliveryTrack([]);
      }
      if (response.data?.status === OrderStatus.COMPLETED) {
        loadReview(orderId);
      } else {
        setReview(null);
      }
      // 详情页拉支付记录：用于退款售后进度（无记录则 null）
      loadPayment(orderId);
    } catch (error: any) {
      setLoading(false);
      setOrder(null);
      setLoadError(true);
      setCanRetry(isRetryableError(error));
      console.error('加载订单失败:', error);
    }
  };

  /** 提交评价 */
  const submitReview = () =>
    reviewAction.run(async () => {
      if (!order) return;
      if (reviewRating < 1 || reviewRating > 5) {
        Taro.showToast({ title: '请选择 1-5 星评分', icon: 'none' });
        return;
      }
      try {
        const res = await post<{
          id: string;
          orderId: string;
          rating: number;
          content: string;
          createdAt: string;
        }>(`/orders/${order.id}/reviews`, {
          rating: reviewRating,
          content: reviewContent.trim(),
        });
        setReview(res.data);
        setReviewContent('');
        setReviewSheetVisible(false);
        Taro.showToast({ title: '评价成功', icon: 'success' });
      } catch (error) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(error)) return;
        console.error('提交评价失败:', error);
      }
    });

  // 仅订单本人（顾客）可提交评价；商家/骑手只读
  const canSubmitReview =
    !!order &&
    order.status === OrderStatus.COMPLETED &&
    !review &&
    userRole === 'customer' &&
    (!!currentUserId ? order.userId === currentUserId : true);

  /** 设置 WebSocket 监听 */
  const setupSocketListener = () => {
    onOrderUpdated((data) => {
      if (data.order.id === orderIdRef.current) {
        loadOrder(orderIdRef.current);
      }
    }, 'order-detail');
    onDeliveryTrackUpdated((data) => {
      if (data.orderId === orderIdRef.current) {
        if (typeof data.riderDeliveryCount === 'number') {
          setOrder((prev) =>
            prev ? { ...prev, riderDeliveryCount: data.riderDeliveryCount } : prev,
          );
        }
        loadDeliveryTrack(orderIdRef.current);
      }
    }, 'order-detail');
  };

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params;
    const orderId = params?.orderId as string;

    if (orderId) {
      orderIdRef.current = orderId;
      loadOrder(orderId);
      // 注册 WebSocket 监听
      setupSocketListener();
    } else {
      setLoading(false);
      Taro.showToast({ title: '订单ID缺失', icon: 'none' });
    }

    return () => {
      removePageListeners('order-detail');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 打开全屏地图时：冻结中心 + 延迟一次性适配路线（可缩放拖动，不再被 prop 拉回） */
  useEffect(() => {
    if (!mapFullscreen) return;
    setFullscreenCenter(fullscreenCenterRef.current);
    const timer = setTimeout(() => fitFullscreenRoute(), 320);
    return () => clearTimeout(timer);
  }, [mapFullscreen, fitFullscreenRoute]);

  /** 待支付倒计时（PAYMENT_TIMEOUT_MINUTES） */
  useEffect(() => {
    if (!order || order.status !== OrderStatus.PENDING_PAYMENT || !order.createdAt) {
      setPayRemainSec(null);
      return;
    }
    const calc = () => {
      const deadline =
        new Date(order.createdAt).getTime() + PAYMENT_TIMEOUT_MINUTES * 60 * 1000;
      return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
    };
    setPayRemainSec(calc());
    const timer = setInterval(() => {
      const left = calc();
      setPayRemainSec(left);
      if (left <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [order?.id, order?.status, order?.createdAt]);

  /** 再来一单：回填购物车商品与备注（发票需在确认页重新填写） */
  const reorder = () =>
    reorderAction.run(async () => {
      if (!order) return;
      try {
        // 清空现有购物车，添加再来一单的商品
        clearCart();
        if (order.shopId) {
          useCartStore.getState().setShopId(order.shopId);
        }
        order.items.forEach((item) => {
          addItem({
            menuItemId: item.menuItemId || item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            specDesc: item.specDesc || '',
            specOptionIds: (item as { specOptionIds?: string[] }).specOptionIds || [],
            imageUrl: item.imageUrl || '',
          });
        });
        if (order.remark) {
          useCartStore.getState().setRemarks(order.remark);
        }
        Taro.showToast({ title: '已加入购物车', icon: 'success' });
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/menu/index' });
        }, 800);
      } catch (error: any) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(error)) return;
        console.error('再来一单失败:', error);
        Taro.showToast({ title: '操作失败', icon: 'none' });
      }
    });

  /** 支付订单 */
  const payOrder = () =>
    payAction.run(async () => {
      if (!order) return;
      try {
        // 后端返回 PaymentResponseDto：
        // - 开发环境 mock: true → 直接显示支付成功
        // - 生产环境 wxPayParams → 调起 Taro.requestPayment 完成真实微信支付
        const res = await post<{
          transactionId: string;
          mock?: boolean;
          provider?: 'sandbox' | 'wechat' | 'third_party';
          wxPayParams?: {
            timeStamp: string;
            nonceStr: string;
            package: string;
            signType: 'MD5' | 'HMAC-SHA256' | 'RSA';
            paySign: string;
          };
        }>(`/orders/${order.id}/pay`);

        // 真实微信支付参数存在时，调起微信支付
        if (res.data.wxPayParams) {
          await Taro.requestPayment({
            timeStamp: res.data.wxPayParams.timeStamp,
            nonceStr: res.data.wxPayParams.nonceStr,
            package: res.data.wxPayParams.package,
            signType: res.data.wxPayParams.signType,
            paySign: res.data.wxPayParams.paySign,
          });
        }
        // mock/sandbox 或真实支付成功后，刷新订单
        const isSandbox = res.data.mock || res.data.provider === 'sandbox';
        Taro.showToast({
          title: isSandbox ? '沙箱支付成功' : '支付成功',
          icon: 'success',
        });
        loadOrder(order.id);
      } catch (error: any) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(error)) return;
        // 用户取消支付（errMsg 含 cancel）不当作错误
        const errMsg = error?.errMsg || error?.message || '';
        if (errMsg.includes('cancel')) {
          Taro.showToast({ title: '已取消支付', icon: 'none' });
        } else {
          console.error('支付失败:', error);
        }
      }
    });

  /** 打开取消/申请取消原因弹层 */
  const openCancelSheet = (mode: 'cancel' | 'request' = 'cancel') => {
    if (!order) return;
    setCancelMode(mode);
    setCancelReason('');
    setCancelSheetVisible(true);
  };

  /** 取消订单或申请取消：原因必填 */
  const cancelOrder = () =>
    cancelAction.run(async () => {
      if (!order) return;
      const reason = cancelReason.trim();
      if (!reason) {
        Taro.showToast({ title: '请填写取消原因', icon: 'none' });
        return;
      }
      if (reason.length < 2) {
        Taro.showToast({ title: '原因至少 2 个字', icon: 'none' });
        return;
      }
      try {
        if (cancelMode === 'request') {
          await post(`/orders/${order.id}/cancel-request`, { reason });
          setCancelSheetVisible(false);
          setCancelReason('');
          Taro.showToast({ title: '已提交取消申请', icon: 'success' });
        } else {
          // 顾客取消走专用 /cancel（含本人校验与已支付退款），不要走商家专用 /status
          await post(`/orders/${order.id}/cancel`, { reason });
          setCancelSheetVisible(false);
          setCancelReason('');
          Taro.showToast({ title: '订单已取消', icon: 'success' });
        }
        loadOrder(order.id);
      } catch (error: any) {
        // 重复提交被请求层拦截，属正常行为，不提示用户
        if (isDuplicateSubmitError(error)) return;
        console.error(cancelMode === 'request' ? '申请取消失败:' : '取消订单失败:', error);
      }
    });

  /** 催单 */
  const urgeOrder = () =>
    urgeAction.run(async () => {
      if (!order) return;
      try {
        await post(`/orders/${order.id}/urge`);
        Taro.showToast({ title: '已催单，商家会尽快处理', icon: 'success' });
        loadOrder(order.id);
      } catch (error: any) {
        if (isDuplicateSubmitError(error)) return;
        console.error('催单失败:', error);
      }
    });


  if (loading) {
    return (
      <View className='order-detail'>
        <SkeletonLoader mode='detail' />
      </View>
    );
  }

  if (!order) {
    if (loadError) {
      return (
        <View className='order-detail'>
          <EmptyState
            icon='warning'
            title='加载失败'
            description={canRetry ? '网络不太稳，点一下再试试' : '订单暂时加载不出来'}
          />
          <FooterBar
            actionOnly
            actionText={canRetry ? '再试一次' : '返回订单列表'}
            onAction={() => {
              if (canRetry && orderIdRef.current) {
                loadOrder(orderIdRef.current);
              } else {
                Taro.switchTab({ url: '/pages/order-list/index' });
              }
            }}
          />
        </View>
      );
    }
    return (
      <View className='order-detail'>
        <EmptyState
          icon='empty'
          title='订单不存在'
          description='可能已删除，或链接失效了'
        />
        <FooterBar
          actionOnly
          actionText='返回订单列表'
          onAction={() => Taro.switchTab({ url: '/pages/order-list/index' })}
        />
      </View>
    );
  }

  const afterSaleInput = {
    status: order.status,
    cancelRequestedAt: order.cancelRequestedAt,
    cancelRequestReason: order.cancelRequestReason,
    cancelReason: order.cancelReason,
    rejectReason: order.rejectReason,
    updatedAt: order.updatedAt,
    // 支付未返回前不传 status，避免「无需退款」闪一下再变「退款成功」
    paymentStatus: paymentLoaded ? payment?.status || null : undefined,
  };
  const afterSaleSteps = buildAfterSaleSteps(afterSaleInput);
  const afterSaleTitle = getCustomerAfterSaleTitle(afterSaleInput);
  const afterSaleHint = getCustomerAfterSaleHint(afterSaleInput);
  // 终态售后等支付结果再展示进度，申请中可立即展示
  const showAfterSalePanel =
    afterSaleSteps.length > 0 &&
    (!!order.cancelRequestedAt || paymentLoaded);
  const statusText =
    afterSaleTitle || getOrderStatusLabel(order.status, order.deliveryType);
  const statusHint =
    afterSaleHint || getCustomerOrderStatusHint(order.status, order.deliveryType);
  const deliveryTypeText = DELIVERY_TYPE_MAP[order.deliveryType] || order.deliveryType;
  // T246.4/T246.5 自取专属：门店信息卡 + 到店核销二维码
  const isPickupOrder = order.deliveryType === DeliveryType.PICKUP;
  const shopAddressText = (order.shopAddress || '').trim();
  const hasShopCoords =
    Number.isFinite(Number(order.shopLatitude)) &&
    Number.isFinite(Number(order.shopLongitude));
  // §3.23 到店核销二维码：自取/堂食在「已接单 ~ 待取餐」阶段展示，待支付/已取消不展示（仅二维码，无文字码）
  const showPickupCode = isPickupOrder
    && [
      OrderStatus.PAID,
      OrderStatus.ACCEPTED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
    ].includes(order.status);
  const canDirectCancel = CUSTOMER_CANCELLABLE_STATUSES.includes(order.status);
  const canRequestCancel =
    CUSTOMER_CANCEL_REQUESTABLE_STATUSES.includes(order.status) && !order.cancelRequestedAt;
  const canUrge = URGEABLE_STATUSES.includes(order.status);
  const urgeCooldownLeftMin = (() => {
    if (!order.lastUrgedAt) return 0;
    const nextAt =
      new Date(order.lastUrgedAt).getTime() + ORDER_URGE_COOLDOWN_MINUTES * 60 * 1000;
    return Math.max(0, Math.ceil((nextAt - Date.now()) / 60000));
  })();
  const urgeDisabled = urgeAction.pending || urgeCooldownLeftMin > 0;
  const etaLabel =
    order.deliveryType === DeliveryType.DELIVERY ? '预计送达' : '预计出餐';
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = order.total;
  const lastTrackPoint = deliveryTrack[deliveryTrack.length - 1];
  const riderDeliveryCount =
    typeof order.riderDeliveryCount === 'number' ? order.riderDeliveryCount : undefined;
  const showRiderDeliveryPanel =
    order.deliveryType === DeliveryType.DELIVERY &&
    order.status === OrderStatus.DELIVERING;
  const shopPoint: MapPoint | null =
    typeof order.shopLatitude === 'number' && typeof order.shopLongitude === 'number'
      ? { latitude: order.shopLatitude, longitude: order.shopLongitude }
      : null;
  const customerPoint: MapPoint | null =
    typeof order.deliveryLatitude === 'number' && typeof order.deliveryLongitude === 'number'
      ? { latitude: order.deliveryLatitude, longitude: order.deliveryLongitude }
      : null;
  const hasMapPoints = !!(shopPoint || customerPoint || lastTrackPoint || deliveryTrack.length > 0);
  const mapCenter: MapPoint =
    lastTrackPoint
    || customerPoint
    || shopPoint
    || { latitude: 28.6820, longitude: 115.8579 }; // 仅作无点兜底中心，不用于标注
  const routePoints: MapPoint[] = [];
  if (shopPoint) routePoints.push(shopPoint);
  if (deliveryTrack.length > 0) {
    routePoints.push(
      ...deliveryTrack.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    );
  }
  if (customerPoint) routePoints.push(customerPoint);
  // 无轨迹且仅有起终点时保留两点预估线
  if (routePoints.length === 0 && shopPoint && customerPoint) {
    routePoints.push(shopPoint, customerPoint);
  }

  const mapIncludePoints: MapPoint[] = [];
  {
    const seen = new Set<string>();
    const push = (p?: MapPoint | null) => {
      if (!p) return;
      const key = `${p.latitude},${p.longitude}`;
      if (seen.has(key)) return;
      seen.add(key);
      mapIncludePoints.push(p);
    };
    push(shopPoint);
    for (const p of routePoints) push(p);
    push(customerPoint);
    if (lastTrackPoint) {
      push({ latitude: lastTrackPoint.latitude, longitude: lastTrackPoint.longitude });
    }
  }
  mapIncludePointsRef.current = mapIncludePoints;
  // 仅在非全屏时更新冻结中心候选，全屏期间保持用户视口
  if (!mapFullscreen) {
    fullscreenCenterRef.current = mapCenter;
  }

  const deliveryPolyline = routePoints.length >= 2
    ? [{
        points: routePoints,
        color: '#FF6B35',
        width: 5,
        dottedLine: deliveryTrack.length === 0,
      }]
    : [];

  const deliveryMarkers: any[] = [
    ...(shopPoint
      ? [{
          id: 1,
          latitude: shopPoint.latitude,
          longitude: shopPoint.longitude,
          iconPath: orderActiveIcon,
          width: 28,
          height: 28,
          callout: {
            content: '商家',
            color: '#FFFFFF',
            fontSize: 11,
            borderRadius: 10,
            borderWidth: 0,
            borderColor: '#FF6B35',
            bgColor: '#FF6B35',
            padding: 4,
            display: 'ALWAYS' as const,
            textAlign: 'center',
            anchorX: 0,
            anchorY: 0,
          },
        }]
      : []),
    ...(customerPoint
      ? [{
          id: 2,
          latitude: customerPoint.latitude,
          longitude: customerPoint.longitude,
          iconPath: orderActiveIcon,
          width: 28,
          height: 28,
          callout: {
            content: '送达',
            color: '#FFFFFF',
            fontSize: 11,
            borderRadius: 10,
            borderWidth: 0,
            borderColor: '#00C853',
            bgColor: '#00C853',
            padding: 4,
            display: 'ALWAYS' as const,
            textAlign: 'center',
            anchorX: 0,
            anchorY: 0,
          },
        }]
      : []),
    ...(lastTrackPoint
      ? [{
          id: 3,
          latitude: lastTrackPoint.latitude,
          longitude: lastTrackPoint.longitude,
          iconPath: orderActiveIcon,
          width: 34,
          height: 34,
          callout: {
            content: '骑手',
            color: '#FFFFFF',
            fontSize: 11,
            borderRadius: 10,
            borderWidth: 0,
            borderColor: '#2196F3',
            bgColor: '#2196F3',
            padding: 4,
            display: 'ALWAYS' as const,
            textAlign: 'center',
            anchorX: 0,
            anchorY: 0,
          },
        }]
      : []),
  ];
  const timelineStatusHistory: OrderStatusHistoryItem[] =
    order.statusHistory && order.statusHistory.length > 0
      ? order.statusHistory
      : [
          { status: OrderStatus.PENDING_PAYMENT, time: order.createdAt },
          ...(order.status !== OrderStatus.PENDING_PAYMENT
            ? [{ status: order.status, time: order.updatedAt || order.createdAt }]
            : []),
        ];

  return (
    <View className='order-detail'>
      <StatusTimeline
        currentStatus={order.status}
        deliveryType={order.deliveryType}
        orderNo={shortOrderId(order.id, order.orderNo)}
        createdAt={order.createdAt}
        statusHistory={timelineStatusHistory}
      />

      <View className='status-summary'>
        <View className='status-summary__main'>
          <Text className='status-summary__title'>{statusText}</Text>
          {statusHint ? (
            <Text className='status-summary__hint'>{statusHint}</Text>
          ) : null}
        </View>

        {order.status === OrderStatus.PENDING_PAYMENT && payRemainSec !== null ? (
          <View
            className={`status-summary__banner ${
              payRemainSec > 0
                ? 'status-summary__banner--warning'
                : 'status-summary__banner--danger'
            }`}
          >
            <Text className='status-summary__banner-text'>
              {payRemainSec > 0
                ? `请在 ${formatPayCountdown(payRemainSec)} 内完成支付，超时将自动取消`
                : `支付已超时（${PAYMENT_TIMEOUT_MINUTES} 分钟），请刷新查看订单状态或重新下单`}
            </Text>
          </View>
        ) : null}

        {order.estimatedCompletion ? (
          <View className='status-summary__eta'>
            <Text className='status-summary__eta-label'>{etaLabel}</Text>
            <Text className='status-summary__eta-value'>
              {formatTime(order.estimatedCompletion, 'MM-DD HH:mm')}
            </Text>
          </View>
        ) : null}

        {/* 取消申请中的详细进度并入本卡，避免双卡割裂 */}

        {(order.shopPhone || order.riderPhone) ? (
          <View className='status-summary__contacts'>
            {order.shopPhone ? (
              <View
                className='status-summary__contact-btn'
                onClick={() => callPhone(order.shopPhone)}
              >
                <Text className='status-summary__contact-text'>联系商家</Text>
              </View>
            ) : null}
            {order.riderPhone ? (
              <View
                className='status-summary__contact-btn'
                onClick={() => callPhone(order.riderPhone)}
              >
                <Text className='status-summary__contact-text'>联系骑手</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {showAfterSalePanel ? (
          <AfterSalePanel
            embedded
            steps={afterSaleSteps}
            refundAmount={payment?.amount ?? order.total}
            paymentStatus={payment?.status}
          />
        ) : null}
      </View>

      {/* 原因卡：进度面板未覆盖完整原因时仍展示 */}
      {(order.cancelReason || order.rejectReason) && !showAfterSalePanel ? (
        <View className='info-card order-reason-card'>
          {order.cancelReason ? (
            <View className='info-row'>
              <Text className='info-row__label'>取消原因</Text>
              <Text className='info-row__value info-row__value--danger'>{order.cancelReason}</Text>
            </View>
          ) : null}
          {order.rejectReason ? (
            <View className='info-row'>
              <Text className='info-row__label'>拒单原因</Text>
              <Text className='info-row__value info-row__value--danger'>{order.rejectReason}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* §3.23 / T246.9 到店核销二维码：内容为订单 ID，商家扫码核销（仅二维码，无文字码） */}
      {showPickupCode ? (
        <View className='pickup-code-card'>
          <Text className='pickup-code-card__label'>到店核销二维码</Text>
          <View
            className='pickup-code-card__qr-row'
            onClick={() => setQrExpanded(true)}
          >
            <Image
              className='pickup-code-card__qr-thumb'
              src={`/api/orders/${order.id}/qrcode`}
              mode='aspectFit'
              showMenuByLongpress={false}
            />
            <Text className='pickup-code-card__qr-tip'>点击放大，扫码核销</Text>
          </View>
          {qrExpanded ? (
            <View
              className='pickup-code-card__qr-expand'
              onClick={() => setQrExpanded(false)}
            >
              <View
                className='pickup-code-card__qr-expand-close'
                onClick={(e) => {
                  e?.stopPropagation?.();
                  setQrExpanded(false);
                }}
              >
                <Text>关闭</Text>
              </View>
              <Image
                className='pickup-code-card__qr-expand-img'
                src={`/api/orders/${order.id}/qrcode`}
                mode='aspectFit'
                onClick={(e) => e?.stopPropagation?.()}
              />
              <Text className='pickup-code-card__qr-expand-hint'>
                出示此码给店员扫码核销
              </Text>
            </View>
          ) : null}
          <Text className='pickup-code-card__hint'>
            {order.status === OrderStatus.READY_FOR_PICKUP
              ? '餐品已备好，请到店向店员扫码核销'
              : '出餐后请到店向店员扫码核销'}
          </Text>
        </View>
      ) : null}

      {/* T246.4 自取门店信息：地址 + 导航/复制 + 拨号 */}
      {isPickupOrder ? (
        <View className='pickup-shop-card'>
          <View className='pickup-shop-card__head'>
            <Text className='pickup-shop-card__name'>{order.shopName || '门店'}</Text>
            <Text className='pickup-shop-card__badge'>到店自取</Text>
          </View>
          <Text className='pickup-shop-card__address'>
            {shopAddressText || '门店地址暂未设置，请致电门店确认'}
          </Text>
          <View className='pickup-shop-card__actions'>
            {shopAddressText ? (
              hasShopCoords ? (
                <View
                  className='pickup-shop-card__btn pickup-shop-card__btn--primary'
                  onClick={() => openShopLocation(order)}
                >
                  <Text className='pickup-shop-card__btn-text'>一键导航</Text>
                </View>
              ) : (
                <View
                  className='pickup-shop-card__btn'
                  onClick={() => copyShopAddress(shopAddressText)}
                >
                  <Text className='pickup-shop-card__btn-text'>复制地址</Text>
                </View>
              )
            ) : null}
            {order.shopPhone ? (
              <View
                className='pickup-shop-card__btn'
                onClick={() => callPhone(order.shopPhone)}
              >
                <Text className='pickup-shop-card__btn-text'>拨打门店</Text>
              </View>
            ) : null}
          </View>
          {shopAddressText && !hasShopCoords ? (
            <Text className='pickup-shop-card__tip'>
              门店暂未设置地图坐标，暂不支持导航，可复制地址后在地图 App 搜索
            </Text>
          ) : null}
        </View>
      ) : null}

      {order.deliveryType === DeliveryType.DELIVERY && (
        <View className='delivery-map'>
          <View className='delivery-map__header'>
            <Text className='delivery-map__title'>配送轨迹</Text>
            <View className='delivery-map__header-right'>
              <Text className='delivery-map__status'>
                {trackLoading
                  ? '更新中'
                  : lastTrackPoint
                    ? `最后更新 ${formatTime(lastTrackPoint.recordedAt, 'HH:mm')}`
                    : !hasMapPoints
                      ? '暂无定位信息'
                      : order.status === OrderStatus.DELIVERING
                        ? '等待骑手上报位置'
                        : '待开始配送'}
              </Text>
            </View>
          </View>
          {hasMapPoints ? (
            <View
              className='delivery-map__map-wrap'
              onClick={() => setMapFullscreen(true)}
            >
              {/* 全屏时卸载预览 map，避免原生组件层级穿透遮罩 */}
              {!mapFullscreen ? (
                <TaroMap
                  className='delivery-map__map'
                  latitude={mapCenter.latitude}
                  longitude={mapCenter.longitude}
                  scale={14}
                  markers={deliveryMarkers}
                  polyline={deliveryPolyline}
                  showLocation={false}
                  enableScroll={false}
                  enableZoom={false}
                  includePoints={mapIncludePoints}
                  onTap={() => setMapFullscreen(true)}
                  onError={() => {
                    console.warn('配送地图加载失败');
                  }}
                />
              ) : (
                <View className='delivery-map__map delivery-map__map--placeholder'>
                  <Text className='delivery-map__tap-tip-text'>全屏查看中</Text>
                </View>
              )}
            </View>
          ) : (
            <View className='delivery-map__empty'>
              <Text className='delivery-map__empty-text'>
                暂无可用坐标。请在地址簿地图选点，或为店铺配置腾讯地图坐标后重新下单。
              </Text>
            </View>
          )}
          {showRiderDeliveryPanel ? (
            <View className='delivery-map__rider-panel'>
              <View className='delivery-map__rider-item'>
                <Text className='delivery-map__rider-label'>骑手位置</Text>
                <Text className='delivery-map__rider-value'>
                  {lastTrackPoint ? formatTime(lastTrackPoint.recordedAt, 'HH:mm') : '待上报'}
                </Text>
              </View>
              <View className='delivery-map__rider-divider' />
              <View className='delivery-map__rider-item'>
                <Text className='delivery-map__rider-label'>手上待配送</Text>
                <Text className='delivery-map__rider-value'>
                  {typeof riderDeliveryCount === 'number' ? `${riderDeliveryCount} 单` : '统计中'}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* 送达凭证：完成后顾客/商家可见 */}
      {order.deliveryType === DeliveryType.DELIVERY && order.deliveryProof ? (
        <View className='delivery-proof'>
          <View className='delivery-proof__header'>
            <Text className='delivery-proof__title'>送达凭证</Text>
            <Text className='delivery-proof__time'>
              {formatTime(order.deliveryProof.deliveredAt, 'MM-DD HH:mm')}
            </Text>
          </View>
          <View className='delivery-proof__meta'>
            <Text className='delivery-proof__meta-text'>
              {order.deliveryProof.forceReason
                ? `强制完成 · ${order.deliveryProof.forceReason}`
                : typeof order.deliveryProof.confirmDistanceM === 'number'
                  ? `距收货点 ${Math.round(order.deliveryProof.confirmDistanceM)} 米${
                      order.deliveryProof.confirmRadiusM
                        ? ` · 围栏 ${Math.round(order.deliveryProof.confirmRadiusM)} 米`
                        : ''
                    }`
                  : order.deliveryProof.confirmSource === 'rider'
                    ? '骑手已确认送达'
                    : '已确认送达'}
            </Text>
          </View>
          {order.deliveryProof.photos?.length ? (
            <View className='delivery-proof__photos'>
              {order.deliveryProof.photos.map((photo, idx) => (
                <Image
                  key={`${photo.url}-${idx}`}
                  className='delivery-proof__photo'
                  src={photo.url}
                  mode='aspectFill'
                  onClick={() => {
                    Taro.previewImage({
                      current: photo.url,
                      urls: order.deliveryProof!.photos.map((p) => p.url),
                    });
                  }}
                />
              ))}
            </View>
          ) : (
            <Text className='delivery-proof__empty'>暂无现场照片</Text>
          )}
        </View>
      ) : null}

      {/* 配送信息：方式 → 地址/桌号 → 联系人 → 电话 → 备注 → 发票 */}
      <View className='info-card'>
        <View className='info-row'>
          <Text className='info-row__label'>配送方式</Text>
          <Text className='info-row__value'>{deliveryTypeText}</Text>
        </View>
        {order.address && (
          <View className='info-row'>
            <Text className='info-row__label'>配送地址</Text>
            <Text className='info-row__value'>{order.address}</Text>
          </View>
        )}
        {order.tableNo && (
          <View className='info-row'>
            <Text className='info-row__label'>桌号</Text>
            <Text className='info-row__value'>{order.tableNo}</Text>
          </View>
        )}
        {order.contactName && (
          <View className='info-row'>
            <Text className='info-row__label'>联系人</Text>
            <Text className='info-row__value'>{order.contactName}</Text>
          </View>
        )}
        {order.contactPhone && (
          <View className='info-row'>
            <Text className='info-row__label'>联系电话</Text>
            <Text className='info-row__value'>{order.contactPhone}</Text>
          </View>
        )}
        {order.remark && (
          <View className='info-row'>
            <Text className='info-row__label'>备注</Text>
            <Text className='info-row__value'>{order.remark}</Text>
          </View>
        )}
        {order.invoiceNeeded && (
          <View className='info-row'>
            <Text className='info-row__label'>发票</Text>
            <Text className='info-row__value'>
              需要开票
              {order.invoiceTitle ? ` · ${order.invoiceTitle}` : ''}
              {order.invoiceTaxNo ? ` · 税号${order.invoiceTaxNo}` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* 商品明细 + 金额（合并卡片） */}
      <View className='order-goods'>
        <Text className='order-goods__title'>商品明细</Text>
        <View className={`order-goods__list ${!goodsExpanded && order.items.length > 3 ? 'order-goods__list--collapsed' : ''}`}>
          {(goodsExpanded || order.items.length <= 3 ? order.items : order.items.slice(0, 3)).map((item) => (
            <View key={item.id} className='order-goods__item'>
              <FoodThumb className='order-goods__item-thumb' src={item.imageUrl} name={item.name} size='sm' round />
              <View className='order-goods__item-main'>
                <Text className='order-goods__item-name'>{item.name}</Text>
                <Text className='order-goods__item-spec'>{item.specDesc || '标准份'}</Text>
              </View>
              <Text className='order-goods__item-qty'>x{item.quantity}</Text>
              <Text className='order-goods__item-price'>
                {formatPriceWithSymbol(item.price)}
              </Text>
            </View>
          ))}
        </View>
        {order.items.length > 3 && (
          <View
            className='order-goods__toggle'
            onClick={() => setGoodsExpanded((v) => !v)}
          >
            <Text className='order-goods__toggle-text'>
              {goodsExpanded ? '收起明细' : `展开全部 ${order.items.length} 件`}
            </Text>
          </View>
        )}

        <View className='order-goods__summary'>
          <View className='price-detail__row'>
            <Text>商品小计</Text>
            <Text className='price-detail__row-value'>
              {formatPriceWithSymbol(subtotal)}
            </Text>
          </View>
          <View className='price-detail__row'>
            <Text>配送费</Text>
            <Text className='price-detail__row-value'>
              {order.deliveryFee > 0
                ? formatPriceWithSymbol(order.deliveryFee)
                : '免费'}
            </Text>
          </View>
          <View className='price-detail__row price-detail__row--total'>
            <Text>实付金额</Text>
            <Text className='price-detail__row-value--bold'>
              {formatPriceWithSymbol(total)}
            </Text>
          </View>
        </View>
      </View>
      {/* 底部操作栏 */}
      <View className='order-actions'>
        {/* 售后处理中：引导联系商家 */}
        {order.cancelRequestedAt && !canDirectCancel && !canRequestCancel ? (
          <View className='order-actions__tip'>
            <Text>取消申请处理中，可联系商家加速处理</Text>
          </View>
        ) : null}
        {order.cancelRequestedAt && order.shopPhone ? (
          <View
            className='order-actions__btn order-actions__btn--secondary'
            onClick={() => callPhone(order.shopPhone)}
          >
            联系商家
          </View>
        ) : null}
        {/* 取消按钮：待支付/已支付可自主取消（已支付触发退款） */}
        {canDirectCancel && (
          <View
            className='order-actions__btn order-actions__btn--danger'
            onClick={() => openCancelSheet('cancel')}
          >
            取消订单
          </View>
        )}
        {/* 接单后不可直接取消：申请取消 */}
        {canRequestCancel && (
          <View
            className='order-actions__btn order-actions__btn--danger'
            onClick={() => openCancelSheet('request')}
          >
            申请取消
          </View>
        )}
        {/* 进行中催单 */}
        {canUrge && (
          <View
            className={`order-actions__btn order-actions__btn--secondary ${urgeDisabled ? 'order-actions__btn--loading' : ''}`}
            onClick={() => {
              if (urgeCooldownLeftMin > 0) {
                Taro.showToast({
                  title: `请 ${urgeCooldownLeftMin} 分钟后再催单`,
                  icon: 'none',
                });
                return;
              }
              urgeOrder();
            }}
          >
            {urgeAction.pending
              ? '催单中...'
              : urgeCooldownLeftMin > 0
                ? `${urgeCooldownLeftMin} 分钟后可催`
                : '催单'}
          </View>
        )}
        {/* 支付按钮：仅待支付状态显示，避免已支付订单重复支付 */}
        {order.status === OrderStatus.PENDING_PAYMENT && (
          <View
            className={`order-actions__btn order-actions__btn--primary ${payAction.pending ? 'order-actions__btn--loading' : ''}`}
            onClick={() => payOrder()}
          >
            {payAction.pending ? '支付中...' : `立即支付 ${formatPriceWithSymbol(total)}`}
          </View>
        )}
        {/* 无主操作时展示状态提示（已有 tip 在顶部，底部仅补空状态） */}
        {[
          OrderStatus.PAID,
          OrderStatus.DELIVERING,
        ].includes(order.status) &&
          !canDirectCancel &&
          !canRequestCancel &&
          !canUrge && (
          <View className='order-actions__tip'>
            <Text>{statusHint || '商家正在处理您的订单，请耐心等待'}</Text>
          </View>
        )}
        {order.status === OrderStatus.COMPLETED && (
          <>
            <View
              className={`order-actions__btn order-actions__btn--secondary ${reorderAction.pending ? 'order-actions__btn--loading' : ''}`}
              onClick={() => reorder()}
            >
              {reorderAction.pending ? '处理中...' : '再来一单'}
            </View>
            {canSubmitReview ? (
              <View
                className='order-actions__btn order-actions__btn--primary'
                onClick={() => setReviewSheetVisible(true)}
              >
                去评价
              </View>
            ) : review ? (
              <View
                className='order-actions__btn order-actions__btn--primary'
                onClick={() => setReviewSheetVisible(true)}
              >
                查看评价
              </View>
            ) : (
              <View
                className='order-actions__btn order-actions__btn--primary'
                onClick={() => {
                  Taro.switchTab({ url: '/pages/menu/index' });
                }}
              >
                继续点餐
              </View>
            )}
          </>
        )}
        {(order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REJECTED) && (
          <>
            <View
              className={`order-actions__btn order-actions__btn--secondary ${reorderAction.pending ? 'order-actions__btn--loading' : ''}`}
              onClick={() => reorder()}
            >
              {reorderAction.pending ? '处理中...' : '再来一单'}
            </View>
            <View
              className='order-actions__btn order-actions__btn--primary'
              onClick={() => {
                Taro.switchTab({ url: '/pages/menu/index' });
              }}
            >
              去点餐
            </View>
          </>
        )}
      </View>

      {/* 评价弹层 */}
      <BottomSheet
        visible={reviewSheetVisible}
        onClose={() => setReviewSheetVisible(false)}
        title={review ? '订单评价' : '写评价'}
        showClose
      >
        <View className='order-review-sheet'>
          {reviewLoading ? (
            <Text className='order-review__hint'>评价加载中...</Text>
          ) : review ? (
            <View className='order-review__readonly'>
              <View className='order-review__stars'>
                {[1, 2, 3, 4, 5].map((star) => (
                  <View
                    key={star}
                    className={`order-review__star ${star <= review.rating ? 'order-review__star--active' : ''}`}
                  >
                    <Icon
                      name={star <= review.rating ? 'star-filled' : 'star'}
                      size={18}
                      color={star <= review.rating ? '#FF6B35' : '#DDDDDD'}
                    />
                  </View>
                ))}
                <Text className='order-review__rating-text'>{review.rating} 分</Text>
              </View>
              {review.content ? (
                <Text className='order-review__content'>{review.content}</Text>
              ) : (
                <Text className='order-review__hint'>用户未填写文字评价</Text>
              )}
              {review.replyContent ? (
                <View className='order-review__reply'>
                  <Text className='order-review__reply-label'>商家回复</Text>
                  <Text className='order-review__reply-text'>{review.replyContent}</Text>
                </View>
              ) : null}
            </View>
          ) : canSubmitReview ? (
            <View className='order-review__form'>
              <Text className='order-review__label'>评分</Text>
              <View className='order-review__stars order-review__stars--editable'>
                {[1, 2, 3, 4, 5].map((star) => (
                  <View
                    key={star}
                    className={`order-review__star ${star <= reviewRating ? 'order-review__star--active' : ''}`}
                    onClick={() => setReviewRating(star)}
                  >
                    <Icon
                      name={star <= reviewRating ? 'star-filled' : 'star'}
                      size={22}
                      color={star <= reviewRating ? '#FF6B35' : '#DDDDDD'}
                    />
                  </View>
                ))}
              </View>
              <Text className='order-review__label'>评价内容（选填）</Text>
              <Textarea
                className='order-review__textarea'
                value={reviewContent}
                maxlength={500}
                placeholder='口味、配送、服务怎么样？'
                onInput={(e) => setReviewContent(e.detail.value)}
              />
              <View
                className={`order-review__submit ${reviewAction.pending ? 'order-review__submit--disabled' : ''}`}
                onClick={() => submitReview()}
              >
                {reviewAction.pending ? '提交中...' : '提交评价'}
              </View>
            </View>
          ) : (
            <Text className='order-review__hint'>暂无评价</Text>
          )}
        </View>
      </BottomSheet>

      {/* 取消原因弹层 */}
      <BottomSheet
        visible={cancelSheetVisible}
        onClose={() => !cancelAction.pending && setCancelSheetVisible(false)}
        title={cancelMode === 'request' ? '申请取消' : '取消订单'}
        showClose
      >
        <View className='order-cancel-sheet'>
          <Text className='order-cancel__hint'>
            {cancelMode === 'request'
              ? '接单后需商家确认。商家同意后订单关闭，如已支付将原路退款。请填写申请原因（至少 2 个字）'
              : order.status === OrderStatus.PAID
                ? '取消后已支付金额将原路退回，请填写取消原因（至少 2 个字）'
                : '请填写取消原因（至少 2 个字）。未支付订单取消后直接关闭'}
          </Text>
          <Textarea
            className='order-cancel__textarea'
            value={cancelReason}
            maxlength={200}
            placeholder='请填写取消原因...'
            onInput={(e) => setCancelReason(e.detail.value)}
            disabled={cancelAction.pending}
          />
          <View className='order-cancel__btns'>
            <View
              className={`order-cancel__btn order-cancel__btn--cancel ${cancelAction.pending ? 'disabled' : ''}`}
              onClick={() => !cancelAction.pending && setCancelSheetVisible(false)}
            >
              再想想
            </View>
            <View
              className={`order-cancel__btn order-cancel__btn--danger ${cancelAction.pending || !cancelReason.trim() ? 'disabled' : ''}`}
              onClick={() => cancelOrder()}
            >
              {cancelAction.pending ? '提交中...' : cancelMode === 'request' ? '提交申请' : '确认取消'}
            </View>
          </View>
        </View>
      </BottomSheet>
      {mapFullscreen && hasMapPoints ? (
        <View className='map-fullscreen'>
          <View className='map-fullscreen__header'>
            <View
              className='map-fullscreen__close'
              onClick={() => setMapFullscreen(false)}
            >
              <Icon name='close' size={18} color='#333333' />
              <Text className='map-fullscreen__close-text'>关闭</Text>
            </View>
            <Text className='map-fullscreen__title'>配送轨迹</Text>
            <View
              className='map-fullscreen__action'
              onClick={() => fitFullscreenRoute()}
            >
              <Text className='map-fullscreen__action-text'>
                {lastTrackPoint ? '全览轨迹' : '预估路线'}
              </Text>
            </View>
          </View>
          <TaroMap
            id={FULLSCREEN_MAP_ID}
            className='map-fullscreen__map'
            latitude={fullscreenCenter.latitude}
            longitude={fullscreenCenter.longitude}
            scale={15}
            markers={deliveryMarkers}
            polyline={deliveryPolyline}
            showLocation={false}
            enableScroll
            enableZoom
            onError={() => {
              console.warn('全屏配送地图加载失败');
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

export default OrderDetailPage;
