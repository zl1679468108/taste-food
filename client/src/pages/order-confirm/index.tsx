import { useState, useEffect, useCallback } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol } from '../../utils/format';
import { DeliveryType } from '../../types/order';
import { DEFAULT_SHOP_ID } from '../../env';
import { Promotion } from '../../types/promotion';
import SectionCard from '../../components/SectionCard';
import FooterBar from '../../components/FooterBar';
import { isValidPhone, isNonEmpty } from '../../utils/validators';
import { estimateDiscount } from '../../utils/promotion';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import './index.scss';

const OrderConfirmPage = () => {
  // Store 订阅（函数组件中正确订阅变化）
  const cartItems = useCartStore((s) => s.items);
  const cartRemarks = useCartStore((s) => s.remarks);
  const cartShopId = useCartStore((s) => s.shopId);
  const clearCart = useCartStore((s) => s.clearCart);
  const setRemarks = useCartStore((s) => s.setRemarks);
  const getTotalPrice = useCartStore((s) => s.getTotalPrice);
  const authLoggedIn = useAuthStore((s) => s.isLoggedIn);

  // 本地状态
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.PICKUP);
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [tableNo, setTableNo] = useState('');
  const { pending: submitting, run: runSubmit } = useAsyncAction();
  const [shopName, setShopName] = useState('');
  const [shopDeliveryFee, setShopDeliveryFee] = useState(0);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);

  const deliveryFee = deliveryType === DeliveryType.DELIVERY ? shopDeliveryFee : 0;

  const loadShopInfo = useCallback(async () => {
    try {
      const res = await get<any>(`/shops/${DEFAULT_SHOP_ID}`);
      const shop = res.data;
      setShopName(shop?.name || '');
      setShopDeliveryFee(shop?.deliveryFee || 0);
    } catch (e) {
      console.error('加载店铺信息失败:', e);
    }
  }, []);

  const loadPromotions = useCallback(async () => {
    setPromotionsLoading(true);
    try {
      const res = await get<any[]>('/promotions', { shopId: DEFAULT_SHOP_ID });
      const activePromos = (res.data || []).filter((p: any) => p.status === 'active');
      setPromotions(activePromos);
    } catch (e) {
      console.error('加载优惠信息失败:', e);
    } finally {
      setPromotionsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 检查购物车
    if (cartItems.length === 0) {
      Taro.showToast({ title: '购物车为空', icon: 'none' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    }
    // 加载店铺信息（配送费、店铺名）
    loadShopInfo();
    // 加载可用优惠
    loadPromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 选择配送方式 */
  const selectDeliveryType = (type: DeliveryType) => {
    setDeliveryType(type);
  };

  /** 提交订单 */
  const submitOrder = async () => {
    if (cartItems.length === 0) {
      Taro.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }

    if (!authLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      Taro.navigateTo({ url: '/pages/auth/login' });
      return;
    }

    // 配送方式为外送时必填地址与联系人
    if (deliveryType === DeliveryType.DELIVERY) {
      if (!isNonEmpty(address)) {
        Taro.showToast({ title: '请填写配送地址', icon: 'none' });
        return;
      }
      if (!isNonEmpty(contactName)) {
        Taro.showToast({ title: '请填写联系人', icon: 'none' });
        return;
      }
      if (!isValidPhone(contactPhone)) {
        Taro.showToast({ title: '请填写正确的手机号', icon: 'none' });
        return;
      }
    }

    // 堂食桌号必填
    if (deliveryType === DeliveryType.DINE_IN && !isNonEmpty(tableNo)) {
      Taro.showToast({ title: '请填写桌号', icon: 'none' });
      return;
    }

    // 外送/自取若填写了手机号则校验格式
    if (isNonEmpty(contactPhone) && !isValidPhone(contactPhone)) {
      Taro.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }

    await runSubmit(async () => {
      const orderData = {
        shopId: cartShopId || DEFAULT_SHOP_ID,
        // 服务端校验菜品价格：仅传 menuItemId/quantity/specDesc，price 由后端从数据库查询
        // 避免客户端篡改 price 导致低价下单
        items: cartItems.map((item) => ({
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          specDesc: item.specDesc || '',
          imageUrl: item.imageUrl || '',
        })),
        deliveryType,
        // deliveryFee 由服务端从店铺配置获取，不信任客户端传值
        address: deliveryType === DeliveryType.DELIVERY ? address : '',
        tableNo: (deliveryType === DeliveryType.DINE_IN || deliveryType === DeliveryType.PICKUP) ? tableNo : '',
        remark: cartRemarks || '',
        contactName: contactName || '',
        contactPhone: contactPhone || '',
      };

      const response = await post<any>('/orders', orderData);

      // 清空购物车
      clearCart();

      Taro.showToast({ title: '下单成功', icon: 'success' });

      // 跳转到订单详情页
      setTimeout(() => {
        Taro.redirectTo({
          url: `/pages/order-detail/index?orderId=${response.data.id}`,
        });
      }, 1000);
    }).catch((error: any) => {
      console.error('提交订单失败:', error);
    });
  };

  /** 添加备注标签 */
  const addRemarkTag = (tag: string) => {
    const current = cartRemarks || '';
    if (current.includes(tag)) return;
    const next = current ? `${current}，${tag}` : tag;
    setRemarks(next);
  };

  const subtotal = getTotalPrice();
  const discountAmount = estimateDiscount(promotions, subtotal);
  const total = Math.max(0, subtotal + deliveryFee - discountAmount);

  const remarkTags = ['少辣', '不要葱', '多醋', '不要辣', '加蒜'];

  return (
    <View className='order-confirm'>
      <View className='order-confirm__content'>
        {/* 配送方式 */}
        <SectionCard className='delivery-section' icon='📦' title='配送方式'>
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
                onClick={() => selectDeliveryType(item.type)}
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
                  value={address}
                  onInput={(e) => setAddress(e.detail.value)}
                />
                <View style={{ display: 'flex', gap: '10px' }}>
                  <Input
                    className='form-input'
                    placeholder='姓名'
                    style={{ flex: 1 }}
                    value={contactName}
                    onInput={(e) => setContactName(e.detail.value)}
                  />
                  <Input
                    className='form-input'
                    placeholder='电话'
                    style={{ flex: 2 }}
                    value={contactPhone}
                    onInput={(e) => setContactPhone(e.detail.value)}
                  />
                </View>
              </>
            ) : deliveryType === DeliveryType.DINE_IN ? (
              <Input
                className='form-input'
                placeholder='请输入桌号（如 A06）'
                value={tableNo}
                onInput={(e) => setTableNo(e.detail.value)}
              />
            ) : (
              <View className='pickup-hint'>请前往：{shopName || '店铺'}自取</View>
            )}
          </View>
        </SectionCard>

        {/* 优惠信息 */}
        {promotions.length > 0 && (
          <SectionCard className='promotion-section' icon='🏷️' title='优惠活动'>
            {promotions.map((promo: Promotion, idx: number) => {
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
                <View key={promo.id} style={{ padding: '6px 0', fontSize: 12, color: '#FF6B35' }}>
                  <Text>🎉 {promo.name}</Text>
                  <Text style={{ marginLeft: 8, color: '#666' }}>{desc}</Text>
                </View>
              );
            })}
          </SectionCard>
        )}

        {/* 商品列表 */}
        <SectionCard className='goods-section' icon='📋' title={`已选菜品 (${cartItems.length}件)`}>
          <View className='goods-list'>
            {cartItems.map((item) => (
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
        </SectionCard>

        {/* 备注 */}
        <SectionCard className='remark-section' icon='💬' title='备注'>
          <View className='remark-input-wrap'>
            <Input
              className='remark-input'
              placeholder='少放辣椒，谢谢'
              value={cartRemarks}
              onInput={(e) => setRemarks(e.detail.value)}
            />
          </View>
          <View className='remark-tags'>
            {remarkTags.map(tag => (
              <View
                key={tag}
                className={`remark-tag ${cartRemarks?.includes(tag) ? 'active' : ''}`}
                onClick={() => addRemarkTag(tag)}
              >
                {tag}
              </View>
            ))}
          </View>
        </SectionCard>

        {/* 价格统计 */}
        <SectionCard className='price-section'>
          <View className='price-item'>
            <Text className='price-label'>菜品小计</Text>
            <Text className='price-value'>{formatPriceWithSymbol(subtotal)}</Text>
          </View>
          <View className='price-item'>
            <Text className='price-label'>配送费</Text>
            <Text className='price-value'>{deliveryFee > 0 ? formatPriceWithSymbol(deliveryFee) : '免费'}</Text>
          </View>
          {discountAmount > 0 && (
            <View className='price-item'>
              <Text className='price-label'>优惠减免</Text>
              <Text className='price-value price-value--discount'>-{formatPriceWithSymbol(discountAmount)}</Text>
            </View>
          )}
        </SectionCard>
      </View>

      <FooterBar
        totalText={formatPriceWithSymbol(total)}
        actionText={submitting ? '提交中...' : '提交订单'}
        actionDisabled={submitting}
        onAction={submitOrder}
      />
    </View>
  );
};

export default OrderConfirmPage;
