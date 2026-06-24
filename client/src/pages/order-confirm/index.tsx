import { Component } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol } from '../../utils/format';
import { DeliveryType } from '../../types/order';
import { DEFAULT_SHOP_ID } from '../../env';
import { Promotion } from '../../types/promotion';
import './index.scss';

interface OrderConfirmState {
  deliveryType: DeliveryType;
  address: string;
  contactName: string;
  contactPhone: string;
  tableNo: string;
  submitting: boolean;
  deliveryFee: number; // 配送费（分）
  promotions: Promotion[];
  promotionsLoading: boolean;
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
      promotions: [],
      promotionsLoading: false,
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
    // 加载可用优惠
    this.loadPromotions();
  }

  async loadPromotions() {
    this.setState({ promotionsLoading: true });
    try {
      const res = await get<any[]>('/promotions', { shopId: DEFAULT_SHOP_ID });
      const activePromos = (res.data || []).filter((p: any) => p.status === 'active');
      this.setState({ promotions: activePromos, promotionsLoading: false });
    } catch (e) {
      console.error('加载优惠信息失败:', e);
      this.setState({ promotionsLoading: false });
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
    const { deliveryType, deliveryFee, address, contactName, contactPhone, tableNo } = this.state;
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
        shopId: cartState.shopId || DEFAULT_SHOP_ID,
        items: cartState.items.map((item) => ({
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          specDesc: item.specDesc || '',
          imageUrl: item.imageUrl || '',
        })),
        deliveryType,
        deliveryFee: deliveryFee,
        address: deliveryType === DeliveryType.DELIVERY ? address : '',
        tableNo: (deliveryType === DeliveryType.DINE_IN || deliveryType === DeliveryType.PICKUP) ? tableNo : '',
        remark: cartState.remarks || '',
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

  /** 添加备注标签 */
  addRemarkTag(tag: string) {
    const cartState = this.cartStore.getState();
    const current = cartState.remarks || '';
    if (current.includes(tag)) return;
    const next = current ? `${current}，${tag}` : tag;
    cartState.setRemarks(next);
  }

  render() {
    const { deliveryType, deliveryFee, submitting } = this.state;
    const cartState = this.cartStore.getState();
    const items = cartState.items;
    const subtotal = cartState.getTotalPrice();
    const total = subtotal + deliveryFee;

    const remarkTags = ['少辣', '不要葱', '多醋', '不要辣', '加蒜'];

    return (
      <View className='order-confirm'>
        <View className='order-confirm__content'>
          {/* 配送方式 */}
          <View className='section-card delivery-section'>
            <View className='section-header'>
              <Text className='section-icon'>📦</Text>
              <Text className='section-title'>配送方式</Text>
            </View>
            <View className='delivery-type-list'>
              {[
                { type: DeliveryType.DELIVERY, icon: '🛵', label: '外卖配送' },
                { type: DeliveryType.PICKUP, icon: '🏪', label: '到店自取' },
                { type: DeliveryType.DINE_IN, icon: '🍽️', label: '堂食' },
              ].map((item) => (
                <View
                  key={item.type}
                  className={`delivery-type-card ${
                    deliveryType === item.type ? 'active' : ''
                  }`}
                  onClick={() => this.selectDeliveryType(item.type)}
                >
                  <Text className='delivery-type-card__icon'>{item.icon}</Text>
                  <Text className='delivery-type-card__label'>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* 配送/桌号信息 */}
            <View className='delivery-info-form'>
              {deliveryType === DeliveryType.DELIVERY ? (
                <>
                  <Input
                    className='form-input'
                    placeholder='请输入配送地址'
                    value={this.state.address}
                    onInput={(e) => this.setState({ address: e.detail.value })}
                  />
                  <View style={{ display: 'flex', gap: '10px' }}>
                    <Input
                      className='form-input'
                      placeholder='姓名'
                      style={{ flex: 1 }}
                      value={this.state.contactName}
                      onInput={(e) => this.setState({ contactName: e.detail.value })}
                    />
                    <Input
                      className='form-input'
                      placeholder='电话'
                      style={{ flex: 2 }}
                      value={this.state.contactPhone}
                      onInput={(e) => this.setState({ contactPhone: e.detail.value })}
                    />
                  </View>
                </>
              ) : deliveryType === DeliveryType.DINE_IN ? (
                <Input
                  className='form-input'
                  placeholder='请输入桌号（如 A06）'
                  value={this.state.tableNo}
                  onInput={(e) => this.setState({ tableNo: e.detail.value })}
                />
              ) : (
                <View className='pickup-hint'>请前往：小买卖烧烤（宝安店）自取</View>
              )}
            </View>
          </View>

          {/* 优惠信息 */}
          {this.state.promotions.length > 0 && (
            <View className='section-card promotion-section'>
              <View className='section-header'>
                <Text className='section-icon'>🏷️</Text>
                <Text className='section-title'>优惠活动</Text>
              </View>
              {this.state.promotions.map((promo: Promotion, idx: number) => {
                const rule = promo.rule || {};
                let desc = '';
                if (promo.type === 'full_discount') {
                  const threshold = (rule.threshold || 0) > 0 ? `¥${((rule.threshold || 0) / 100).toFixed(2)}` : '';
                  const discount = (rule.discount || 0) > 0 ? `¥${((rule.discount || 0) / 100).toFixed(2)}` : '';
                  desc = threshold ? `满${threshold}减${discount}` : promo.description || promo.name;
                } else if (promo.type === 'first_order') {
                  desc = promo.description || '首单立减';
                } else {
                  desc = promo.description || promo.name;
                }
                return (
                  <View key={promo.id} style={{ padding: '6px 0', fontSize: 12, color: '#e74c3c' }}>
                    <Text>🎉 {promo.name}</Text>
                    <Text style={{ marginLeft: 8, color: '#666' }}>{desc}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* 商品列表 */}
          <View className='section-card goods-section'>
            <View className='section-header'>
              <Text className='section-icon'>📋</Text>
              <Text className='section-title'>已选菜品 ({items.length}件)</Text>
            </View>
            <View className='goods-list'>
              {items.map((item) => (
                <View key={item.key} className='goods-item'>
                  <View className='goods-item__image'>
                    <Text style={{ fontSize: '40rpx' }}>🍖</Text>
                  </View>
                  <View className='goods-item__info'>
                    <Text className='goods-item__name'>{item.name}</Text>
                    <Text className='goods-item__spec'>{item.specDesc || '标准份'}</Text>
                  </View>
                  <View className='goods-item__right'>
                    <Text className='goods-item__price'>{formatPriceWithSymbol(item.price)}</Text>
                    <Text className='goods-item__qty'>x{item.quantity}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 备注 */}
          <View className='section-card remark-section'>
            <View className='section-header'>
              <Text className='section-icon'>💬</Text>
              <Text className='section-title'>备注</Text>
            </View>
            <View className='remark-input-wrap'>
              <Input
                className='remark-input'
                placeholder='少放辣椒，谢谢'
                value={cartState.remarks}
                onInput={(e) => cartState.setRemarks(e.detail.value)}
              />
            </View>
            <View className='remark-tags'>
              {remarkTags.map(tag => (
                <View 
                  key={tag} 
                  className={`remark-tag ${cartState.remarks?.includes(tag) ? 'active' : ''}`}
                  onClick={() => this.addRemarkTag(tag)}
                >
                  {tag}
                </View>
              ))}
            </View>
          </View>

          {/* 价格统计 */}
          <View className='section-card price-section'>
            <View className='price-item'>
              <Text className='price-label'>菜品小计</Text>
              <Text className='price-value'>{formatPriceWithSymbol(subtotal)}</Text>
            </View>
            <View className='price-item'>
              <Text className='price-label'>配送费</Text>
              <Text className='price-value'>{deliveryFee > 0 ? formatPriceWithSymbol(deliveryFee) : '免费'}</Text>
            </View>
          </View>
        </View>

        {/* 底部提交栏 */}
        <View className='footer-bar'>
          <View className='footer-left'>
            <Text className='total-label'>合计：</Text>
            <Text className='total-price'>{formatPriceWithSymbol(total)}</Text>
          </View>
          <View 
            className={`submit-btn ${submitting ? 'disabled' : ''}`}
            onClick={() => !submitting && this.submitOrder()}
          >
            {submitting ? '提交中...' : '提交订单'}
          </View>
        </View>
      </View>
    );
  }
}
