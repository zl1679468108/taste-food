import { useState, useEffect, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { formatPriceWithSymbol, formatTime, shortOrderId } from '../../utils/format';
import { ORDER_STATUS_MAP, ORDER_STATUS_COLOR_MAP, DELIVERY_TYPE_MAP } from '../../utils/constants';
import { Order, OrderStatus } from '../../types/order';
import { onOrderUpdated, removePageListeners } from '../../services/socket';
import './index.scss';

const OrderDetailPage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const clearCart = useCartStore((s) => s.clearCart);
  const addItem = useCartStore((s) => s.addItem);

  // 本地状态
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [deliveryFee] = useState(0);

  // orderId 跨渲染持久化（不触发重渲染）
  const orderIdRef = useRef<string>('');

  /** 加载订单详情 */
  const loadOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const response = await get<Order>(`/orders/${orderId}`);
      setOrder(response.data);
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
      console.error('加载订单失败:', error);
    }
  };

  /** 设置 WebSocket 监听 */
  const setupSocketListener = () => {
    onOrderUpdated((data) => {
      if (data.order.id === orderIdRef.current) {
        loadOrder(orderIdRef.current);
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

  /** 再来一单 */
  const reorder = async () => {
    if (!order) return;

    try {
      // 清空现有购物车，添加再来一单的商品
      clearCart();
      order.items.forEach((item) => {
        addItem({
          menuItemId: item.menuItemId || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          specDesc: item.specDesc || '',
          imageUrl: item.imageUrl || '',
        });
      });
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
      // mock 模式或真实支付成功后，刷新订单
      Taro.showToast({ title: '支付成功', icon: 'success' });
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

  /** 获取状态对应的 Emoji */
  const getStatusEmoji = (status: string): string => {
    const map: Record<string, string> = {
      [OrderStatus.PENDING_PAYMENT]: '⏳',
      [OrderStatus.PAID]: '✅',
      [OrderStatus.ACCEPTED]: '👍',
      [OrderStatus.PREPARING]: '👨‍🍳',
      [OrderStatus.DELIVERING]: '🛵',
      [OrderStatus.COMPLETED]: '🎉',
      [OrderStatus.CANCELLED]: '🗑️',
      [OrderStatus.REJECTED]: '❌',
    };
    return map[status] || '📋';
  };

  if (loading) {
    return (
      <View className='order-detail'>
        <View className='detail-loading'>
          <Text>加载中...</Text>
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View className='order-detail'>
        <View className='detail-loading'>
          <Text>订单不存在</Text>
        </View>
      </View>
    );
  }

  const statusText = ORDER_STATUS_MAP[order.status] || order.status;
  const statusColor = ORDER_STATUS_COLOR_MAP[order.status] || '#999';
  const deliveryTypeText = DELIVERY_TYPE_MAP[order.deliveryType] || order.deliveryType;
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = order.total;

  return (
    <View className='order-detail'>
      {/* 状态卡片 */}
      <View className={`status-card status-card--${order.status}`}>
        <Text className='status-card__icon'>{getStatusEmoji(order.status)}</Text>
        <Text className='status-card__status'>{statusText}</Text>
        <Text className='status-card__time'>
          下单时间: {formatTime(order.createdAt)}
        </Text>
        {order.estimatedCompletion && (
          <Text className='status-card__estimated'>
            预计完成: {formatTime(order.estimatedCompletion)}
          </Text>
        )}
      </View>

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

      {/* 商品列表 */}
      <View className='order-goods'>
        <Text className='order-goods__title'>商品明细</Text>
        {order.items.map((item) => (
          <View key={item.id} className='order-goods__item'>
            <Text className='order-goods__item-name'>{item.name}</Text>
            <Text className='order-goods__item-price'>
              {formatPriceWithSymbol(item.price)}
            </Text>
            <Text className='order-goods__item-qty'>x{item.quantity}</Text>
          </View>
        ))}
      </View>

      {/* 价格明细 */}
      <View className='price-detail'>
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
        {(order.status === OrderStatus.PAID || order.status === OrderStatus.ACCEPTED || order.status === OrderStatus.PREPARING || order.status === OrderStatus.DELIVERING) && (
          <View className='order-actions__tip'>
            <Text>商家正在处理您的订单，请耐心等待</Text>
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
            <View
              className='order-actions__btn order-actions__btn--primary'
              onClick={() => {
                // menu 是 tabbar 页面，必须用 switchTab 跳转
                Taro.switchTab({ url: '/pages/menu/index' });
              }}
            >
              继续点餐
            </View>
          </>
        )}
        {order.status === OrderStatus.CANCELLED && (
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
    </View>
  );
};

export default OrderDetailPage;
