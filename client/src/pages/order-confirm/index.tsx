import { Component } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { post } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol } from '../../utils/format';
import { DeliveryType } from '../../types/order';
import './index.scss';

interface OrderConfirmState {
  deliveryType: DeliveryType;
  address: string;
  contactName: string;
  contactPhone: string;
  tableNo: string;
  submitting: boolean;
  deliveryFee: number; // 配送费（分）
}

export default class OrderConfirmPage extends Component<{}, OrderConfirmState> {
  private cartStore = useCartStore;
  private authStore = useAuthStore;

  constructor(props: {}) {
    super(props);

    this.state = {
      deliveryType: DeliveryType.PICKUP,
      address: '',
      contactName: '',
      contactPhone: '',
      tableNo: '',
      submitting: false,
      deliveryFee: 0, // 自取免配送费
    };
  }

  componentDidMount() {
    // 检查购物车
    const cartState = this.cartStore.getState();
    if (cartState.items.length === 0) {
      Taro.showToast({ title: '购物车为空', icon: 'none' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    }
  }

  /** 选择配送方式 */
  selectDeliveryType(type: DeliveryType) {
    let deliveryFee = 0;
    if (type === DeliveryType.DELIVERY) {
      deliveryFee = 500; // 配送费 5 元
    }
    this.setState({ deliveryType: type, deliveryFee });
  }

  /** 提交订单 */
  async submitOrder() {
    const { deliveryType, address, contactName, contactPhone, tableNo } = this.state;
    const cartState = this.cartStore.getState();
    const authState = this.authStore.getState();

    if (cartState.items.length === 0) {
      Taro.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }

    if (!authState.isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      Taro.navigateTo({ url: '/pages/auth/login' });
      return;
    }

    // 配送方式为外送时必填地址
    if (deliveryType === DeliveryType.DELIVERY && !address) {
      Taro.showToast({ title: '请填写配送地址', icon: 'none' });
      return;
    }

    this.setState({ submitting: true });

    try {
      const orderData = {
        shopId: cartState.shopId || '00000000-0000-0000-0000-000000000001',
        items: cartState.items.map((item) => ({
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          specDesc: item.specDesc || '',
          imageUrl: item.imageUrl || '',
        })),
        deliveryType,
        address: deliveryType === DeliveryType.DELIVERY ? address : '',
        tableNo: deliveryType === DeliveryType.DINE_IN ? tableNo : '',
        remark: cartState.remarks,
        contactName: contactName || '',
        contactPhone: contactPhone || '',
      };

      const response = await post<any>('/orders', orderData);

      // 清空购物车
      cartState.clearCart();

      Taro.showToast({ title: '下单成功', icon: 'success' });

      // 跳转到订单详情页
      setTimeout(() => {
        Taro.redirectTo({
          url: `/pages/order-detail/index?orderId=${response.data.id}`,
        });
      }, 1000);
    } catch (error: any) {
      console.error('提交订单失败:', error);
    } finally {
      this.setState({ submitting: false });
    }
  }

  render() {
    const { deliveryType, deliveryFee, submitting } = this.state;
    const cartState = this.cartStore.getState();
    const items = cartState.items;
    const subtotal = cartState.getTotalPrice();
    const total = subtotal + deliveryFee;

    return (
      <View className='order-confirm'>
        {/* 配送方式 */}
        <View className='delivery-section'>
          <Text className='delivery-section__title'>配送方式</Text>
          <View className='delivery-type-list'>
            {[
              { type: DeliveryType.PICKUP, icon: '🚶', label: '到店自取' },
              { type: DeliveryType.DINE_IN, icon: '🍽️', label: '堂食' },
              { type: DeliveryType.DELIVERY, icon: '🛵', label: '外卖配送' },
            ].map((item) => (
              <View
                key={item.type}
                className={`delivery-type-item ${
                  deliveryType === item.type ? 'delivery-type-item--active' : ''
                }`}
                onClick={() => this.selectDeliveryType(item.type)}
              >
                <Text className='delivery-type-item__icon'>{item.icon}</Text>
                <Text>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* 配送信息填写 */}
          {deliveryType === DeliveryType.DELIVERY && (
            <View className='delivery-form'>
              <View className='delivery-form__field'>
                <Text className='delivery-form__field-label'>收货地址</Text>
                <Input
                  className='delivery-form__field-input'
                  placeholder='请输入地址'
                  value={this.state.address}
                  onInput={(e) =>
                    this.setState({ address: e.detail.value })
                  }
                />
              </View>
              <View className='delivery-form__field'>
                <Text className='delivery-form__field-label'>联系人</Text>
                <Input
                  className='delivery-form__field-input'
                  placeholder='请输入姓名'
                  value={this.state.contactName}
                  onInput={(e) =>
                    this.setState({ contactName: e.detail.value })
                  }
                />
              </View>
              <View className='delivery-form__field'>
                <Text className='delivery-form__field-label'>联系电话</Text>
                <Input
                  className='delivery-form__field-input'
                  placeholder='请输入手机号'
                  value={this.state.contactPhone}
                  onInput={(e) =>
                    this.setState({ contactPhone: e.detail.value })
                  }
                />
              </View>
            </View>
          )}

          {deliveryType === DeliveryType.DINE_IN && (
            <View className='delivery-form'>
              <View className='delivery-form__field'>
                <Text className='delivery-form__field-label'>桌号</Text>
                <Input
                  className='delivery-form__field-input'
                  placeholder='请输入桌号（如 A06）'
                  value={this.state.tableNo}
                  onInput={(e) =>
                    this.setState({ tableNo: e.detail.value })
                  }
                />
              </View>
            </View>
          )}
        </View>

        {/* 商品列表 */}
        <View className='goods-section'>
          <Text className='goods-section__title'>
            商品 ({items.length} 种)
          </Text>
          {items.map((item) => (
            <View key={item.key} className='goods-item'>
              <View
                className='goods-item__image'
                style={{
                  background: `linear-gradient(135deg, #ff6b6b, #ffa07a)`,
                }}
              >
                <Text>🍖</Text>
              </View>
              <View className='goods-item__info'>
                <Text className='goods-item__name'>{item.name}</Text>
                {item.specDesc && (
                  <Text className='goods-item__spec'>{item.specDesc}</Text>
                )}
              </View>
              <View className='goods-item__right'>
                <Text className='goods-item__price'>
                  {formatPriceWithSymbol(item.price)}
                </Text>
                <Text className='goods-item__qty'>x{item.quantity}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 备注 */}
        <View className='remark-section'>
          <Text className='remark-section__title'>订单备注</Text>
          <Input
            className='remark-section__input'
            placeholder='请输入备注（如：少放辣椒、不要香菜等）'
            value={cartState.remarks}
            onInput={(e) => cartState.setRemarks(e.detail.value)}
          />
        </View>

        {/* 价格汇总 */}
        <View className='price-summary'>
          <View className='price-row'>
            <Text>商品小计</Text>
            <Text className='price-row__value'>
              {formatPriceWithSymbol(subtotal)}
            </Text>
          </View>
          <View className='price-row'>
            <Text>配送费</Text>
            <Text className='price-row__value'>
              {deliveryFee > 0
                ? formatPriceWithSymbol(deliveryFee)
                : '免费'}
            </Text>
          </View>
          <View className='price-row price-row--total'>
            <Text>实付金额</Text>
            <Text className='price-row__value--bold'>
              {formatPriceWithSymbol(total)}
            </Text>
          </View>
        </View>

        {/* 底部提交栏 */}
        <View className='submit-bar'>
          <Text className='submit-bar__total'>合计</Text>
          <Text className='submit-bar__price'>
            {formatPriceWithSymbol(total)}
          </Text>
          <View
            className={`submit-bar__btn ${
              submitting ? 'submit-bar__btn--disabled' : ''
            }`}
            onClick={() => this.submitOrder()}
          >
            {submitting ? '提交中...' : '提交订单'}
          </View>
        </View>
      </View>
    );
  }
}
