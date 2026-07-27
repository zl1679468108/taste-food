import { useState, useEffect, useRef } from 'react';
import { View, Text, Textarea, Map as TaroMap } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post, isRetryableError } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol, formatTime, shortOrderId } from '../../utils/format';
import { DELIVERY_TYPE_MAP, getOrderStatusLabel, getCustomerOrderStatusHint } from '../../utils/constants';
import { DeliveryTrackPoint, Order, OrderStatus, DeliveryType } from '../../types/order';
import { onDeliveryTrackUpdated, onOrderUpdated, removePageListeners } from '../../services/socket';
import StatusTimeline from '../../components/StatusTimeline';
import SkeletonLoader from '../../components/SkeletonLoader';
import Icon from '../../components/Icon';
import EmptyState from '../../components/EmptyState';
import BottomSheet from '../../components/BottomSheet';
import orderActiveIcon from '../../assets/icons/order-active.png';
import './index.scss';

const DEFAULT_SHOP_COORD = { latitude: 30.27415, longitude: 120.15515 };
const DEFAULT_CUSTOMER_COORD = { latitude: 30.27958, longitude: 120.16638 };

type MapPoint = {
  latitude: number;
  longitude: number;
};

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
  const [paying, setPaying] = useState(false);
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
  const [submittingReview, setSubmittingReview] = useState(false);
  const [goodsExpanded, setGoodsExpanded] = useState(false);
  const [reviewSheetVisible, setReviewSheetVisible] = useState(false);

  // orderId 跨渲染持久化（不触发重渲染）
  const orderIdRef = useRef<string>('');

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
    } catch (error: any) {
      setLoading(false);
      setOrder(null);
      setLoadError(true);
      setCanRetry(isRetryableError(error));
      console.error('加载订单失败:', error);
    }
  };

  /** 提交评价 */
  const submitReview = async () => {
    if (!order || submittingReview) return;
    if (reviewRating < 1 || reviewRating > 5) {
      Taro.showToast({ title: '请选择 1-5 星评分', icon: 'none' });
      return;
    }
    setSubmittingReview(true);
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
      console.error('提交评价失败:', error);
    } finally {
      setSubmittingReview(false);
    }
  };

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

  /** 再来一单：回填购物车商品与备注（发票需在确认页重新填写） */
  const reorder = async () => {
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
      console.error('再来一单失败:', error);
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  };

  /** 支付订单 */
  const payOrder = async () => {
    if (!order) return;

    setPaying(true);
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
      // 用户取消支付（errMsg 含 cancel）不当作错误
      const errMsg = error?.errMsg || error?.message || '';
      if (errMsg.includes('cancel')) {
        Taro.showToast({ title: '已取消支付', icon: 'none' });
      } else {
        console.error('支付失败:', error);
      }
    } finally {
      setPaying(false);
    }
  };

  /** 取消订单 */
  const cancelOrder = async () => {
    if (!order) return;

    Taro.showModal({
      title: '确认取消',
      content: '确定要取消此订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await post(`/orders/${order.id}/status`, { status: OrderStatus.CANCELLED });
            Taro.showToast({ title: '订单已取消', icon: 'success' });
            loadOrder(order.id);
          } catch (error: any) {
            console.error('取消订单失败:', error);
          }
        }
      },
    });
  };


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
          actionText='返回订单列表'
          onAction={() => Taro.switchTab({ url: '/pages/order-list/index' })}
        />
      </View>
    );
  }

  const statusText = getOrderStatusLabel(order.status, order.deliveryType);
  const statusHint = getCustomerOrderStatusHint(order.status, order.deliveryType);
  const deliveryTypeText = DELIVERY_TYPE_MAP[order.deliveryType] || order.deliveryType;
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = order.total;
  const lastTrackPoint = deliveryTrack[deliveryTrack.length - 1];
  const mapCenter: MapPoint = lastTrackPoint || DEFAULT_CUSTOMER_COORD;
  const routePoints: MapPoint[] =
    deliveryTrack.length > 0
      ? [DEFAULT_SHOP_COORD, ...deliveryTrack.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        })), DEFAULT_CUSTOMER_COORD]
      : [DEFAULT_SHOP_COORD, DEFAULT_CUSTOMER_COORD];
  const deliveryMarkers: any[] = [
    {
      id: 1,
      latitude: DEFAULT_SHOP_COORD.latitude,
      longitude: DEFAULT_SHOP_COORD.longitude,
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
    },
    {
      id: 2,
      latitude: DEFAULT_CUSTOMER_COORD.latitude,
      longitude: DEFAULT_CUSTOMER_COORD.longitude,
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
    },
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

  return (
    <View className='order-detail'>
      <StatusTimeline
        currentStatus={order.status}
        deliveryType={order.deliveryType}
        subtitle={`当前${statusText} · 下单 ${formatTime(order.createdAt, 'MM-DD HH:mm')}`}
        statusHistory={[
          { status: 'pending_payment', time: order.createdAt },
          ...(order.status !== 'pending_payment'
            ? [{ status: order.status, time: order.updatedAt || order.createdAt }]
            : []),
        ]}
      />

      {order.deliveryType === DeliveryType.DELIVERY && (
        <View className='delivery-map'>
          <View className='delivery-map__header'>
            <Text className='delivery-map__title'>配送轨迹</Text>
            <Text className='delivery-map__status'>
              {trackLoading
                ? '更新中'
                : lastTrackPoint
                  ? `最后更新 ${formatTime(lastTrackPoint.recordedAt, 'HH:mm')}`
                  : order.status === OrderStatus.DELIVERING
                    ? '等待骑手上报位置'
                    : '待开始配送'}
            </Text>
          </View>
          <TaroMap
            className='delivery-map__map'
            latitude={mapCenter.latitude}
            longitude={mapCenter.longitude}
            scale={14}
            markers={deliveryMarkers}
            polyline={[{
              points: routePoints,
              color: '#FF6B35',
              width: 5,
              dottedLine: deliveryTrack.length === 0,
            }]}
            showLocation={false}
            onError={() => {
              console.warn('配送地图加载失败');
            }}
          />
          <View className='delivery-map__meta'>
            <View className='delivery-map__meta-item'>
              <View className='delivery-map__legend-dot delivery-map__legend-dot--shop' />
              <Text className='delivery-map__meta-text'>商家</Text>
            </View>
            <View className='delivery-map__meta-line' />
            <View className='delivery-map__meta-item'>
              <View className='delivery-map__legend-dot delivery-map__legend-dot--route' />
              <Text className='delivery-map__meta-text'>
                {lastTrackPoint ? '配送中' : '预估路线'}
              </Text>
            </View>
            <View className='delivery-map__meta-line' />
            <View className='delivery-map__meta-item'>
              <View className='delivery-map__legend-dot delivery-map__legend-dot--dest' />
              <Text className='delivery-map__meta-text'>送达</Text>
            </View>
          </View>
        </View>
      )}

      {/* 配送信息 */}
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
      </View>

      {/* 商品明细 + 金额（合并卡片） */}
      <View className='order-goods'>
        <Text className='order-goods__title'>商品明细</Text>
        <View className={`order-goods__list ${!goodsExpanded && order.items.length > 3 ? 'order-goods__list--collapsed' : ''}`}>
          {(goodsExpanded || order.items.length <= 3 ? order.items : order.items.slice(0, 3)).map((item) => (
            <View key={item.id} className='order-goods__item'>
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
      {/* 订单信息 */}
      <View className='order-meta'>
        <Text className='order-meta__item'>
          订单号: {shortOrderId(order.id)}
        </Text>
        <Text className='order-meta__item'>
          下单时间: {formatTime(order.createdAt, 'YYYY-MM-DD HH:mm:ss')}
        </Text>
      </View>

      {/* 底部操作栏 */}
      <View className='order-actions'>
        {/* 取消按钮：待支付/已支付均可取消（已支付触发退款） */}
        {[OrderStatus.PENDING_PAYMENT, OrderStatus.PAID].includes(order.status) && (
          <View
            className='order-actions__btn order-actions__btn--danger'
            onClick={() => cancelOrder()}
          >
            取消订单
          </View>
        )}
        {/* 支付按钮：仅待支付状态显示，避免已支付订单重复支付 */}
        {order.status === OrderStatus.PENDING_PAYMENT && (
          <View
            className={`order-actions__btn order-actions__btn--primary ${paying ? 'order-actions__btn--loading' : ''}`}
            onClick={() => !paying && payOrder()}
          >
            {paying ? '支付中...' : `立即支付 ${formatPriceWithSymbol(total)}`}
          </View>
        )}
        {[
          OrderStatus.PAID,
          OrderStatus.ACCEPTED,
          OrderStatus.PREPARING,
          OrderStatus.READY_FOR_PICKUP,
          OrderStatus.DELIVERING,
        ].includes(order.status) && (
          <View className='order-actions__tip'>
            <Text>{statusHint || '商家正在处理您的订单，请耐心等待'}</Text>
          </View>
        )}
        {order.status === OrderStatus.COMPLETED && (
          <>
            <View
              className='order-actions__btn order-actions__btn--secondary'
              onClick={() => reorder()}
            >
              再来一单
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
              className='order-actions__btn order-actions__btn--secondary'
              onClick={() => reorder()}
            >
              再来一单
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
                className={`order-review__submit ${submittingReview ? 'order-review__submit--disabled' : ''}`}
                onClick={() => !submittingReview && submitReview()}
              >
                {submittingReview ? '提交中...' : '提交评价'}
              </View>
            </View>
          ) : (
            <Text className='order-review__hint'>暂无评价</Text>
          )}
        </View>
      </BottomSheet>
    </View>
  );
};

export default OrderDetailPage;
