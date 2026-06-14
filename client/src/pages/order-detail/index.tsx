import { Component } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { formatPriceWithSymbol, formatTime, shortOrderId } from '../../utils/format';
import { ORDER_STATUS_MAP, ORDER_STATUS_COLOR_MAP, DELIVERY_TYPE_MAP } from '../../utils/constants';
import { Order, OrderStatus } from '../../types/order';
import { onOrderUpdated, removeAllListeners } from '../../services/socket';
import './index.scss';

interface OrderDetailState {
  order: Order | null;
  loading: boolean;
  paying: boolean;
  deliveryFee: number;
}

export default class OrderDetailPage extends Component<{}, OrderDetailState> {
  constructor(props: {}) {
    super(props);

    this.state = {
      order: null,
      loading: true,
      paying: false,
      deliveryFee: 500,
    };
  }

  componentDidMount() {
    const params = Taro.getCurrentInstance().router?.params;
    const orderId = params?.orderId as string;

    if (orderId) {
      this.orderId = orderId;
      this.loadOrder(orderId);
      // 注册 WebSocket 监听
      this.setupSocketListener();
    } else {
      this.setState({ loading: false });
      Taro.showToast({ title: '订单ID缺失', icon: 'none' });
    }
  }

  private orderId: string = '';

  /** 设置 WebSocket 监听 */
  setupSocketListener() {
    onOrderUpdated((data) => {
      if (data.order.id === this.orderId) {
        console.log('[WS] 订单详情页收到更新，刷新数据');
        this.loadOrder(this.orderId);
      }
    });
  }

  componentWillUnmount() {
    removeAllListeners();
  }

  async loadOrder(orderId: string) {
    this.setState({ loading: true });
    try {
      const response = await get<Order>(`/orders/${orderId}`);
      this.setState({ order: response.data, loading: false });
    } catch (error: any) {
      this.setState({ loading: false });
      console.error('加载订单失败:', error);
    }
  }

  /** 支付订单 */
  async payOrder() {
    const { order } = this.state;
    if (!order) return;

    this.setState({ paying: true });
    try {
      await post(`/orders/${order.id}/pay`);
      Taro.showToast({ title: '支付成功', icon: 'success' });
      // 重新加载订单
      this.loadOrder(order.id);
    } catch (error: any) {
      console.error('支付失败:', error);
    } finally {
      this.setState({ paying: false });
    }
  }

  /** 取消订单 */
  async cancelOrder() {
    const { order } = this.state;
    if (!order) return;

    Taro.showModal({
      title: '确认取消',
      content: '确定要取消此订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await post(`/orders/${order.id}/status`, { status: OrderStatus.CANCELLED });
            Taro.showToast({ title: '订单已取消', icon: 'success' });
            this.loadOrder(order.id);
          } catch (error: any) {
            console.error('取消订单失败:', error);
          }
        }
      },
    });
  }

  /** 获取状态对应的 Emoji */
  getStatusEmoji(status: string): string {
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
  }

  render() {
    const { order, loading, paying } = this.state;

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
          <Text className='status-card__icon'>{this.getStatusEmoji(order.status)}</Text>
          <Text className='status-card__status'>{statusText}</Text>
          <Text className='status-card__time'>
            下单时间: {formatTime(order.createdAt)}
          </Text>
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
              {total - subtotal > 0
                ? formatPriceWithSymbol(total - subtotal)
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
          {order.status === OrderStatus.PENDING_PAYMENT && (
            <>
              <View
                className='order-actions__btn order-actions__btn--danger'
                onClick={() => this.cancelOrder()}
              >
                取消订单
              </View>
              <View
                className={`order-actions__btn order-actions__btn--primary ${paying ? '' : ''}`}
                onClick={() => !paying && this.payOrder()}
              >
                {paying ? '支付中...' : `立即支付 ${formatPriceWithSymbol(total)}`}
              </View>
            </>
          )}
        </View>
      </View>
    );
  }
}
