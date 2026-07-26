import Icon, { type IconName } from '../../components/Icon';
import FoodThumb from '../../components/FoodThumb';
import { useState, useEffect, useCallback } from 'react';
import { View, Text, Input, Switch } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol } from '../../utils/format';
import { DeliveryType } from '../../types/order';
import { DEFAULT_SHOP_ID } from '../../env';
import { loadDineContext } from '../../utils/dine-context';
import { Promotion } from '../../types/promotion';
import SectionCard from '../../components/SectionCard';
import FooterBar from '../../components/FooterBar';
import { isValidPhone, isNonEmpty } from '../../utils/validators';
import { estimateDiscount } from '../../utils/promotion';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import type { AddressItem } from '../address/index';
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
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopDeliveryFee, setShopDeliveryFee] = useState(0);
  const [shopOpen, setShopOpen] = useState(true);
  const [nextOpenHint, setNextOpenHint] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressItem | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [invoiceNeeded, setInvoiceNeeded] = useState(false);
  const [invoiceTitle, setInvoiceTitle] = useState('');
  const [invoiceTaxNo, setInvoiceTaxNo] = useState('');

  const deliveryFee = deliveryType === DeliveryType.DELIVERY ? shopDeliveryFee : 0;

  // 扫码入座上下文：默认堂食 + 桌号
  useEffect(() => {
    const ctx = loadDineContext();
    if (!ctx?.tableNo) return;
    setDeliveryType(DeliveryType.DINE_IN);
    setTableNo(ctx.tableNo);
  }, []);


  const loadShopInfo = useCallback(async () => {
    try {
      const res = await get<any>(`/shops/${DEFAULT_SHOP_ID}`);
      const shop = res.data;
      setShopName(shop?.name || '');
      setShopAddress(shop?.address || '');
      setShopPhone(shop?.phone || '');
      setShopDeliveryFee(shop?.deliveryFee || 0);
      // 与菜单页一致：显式 isOpenNow 优先，否则回退 status
      const open =
        typeof shop?.isOpenNow === 'boolean' ? !!shop.isOpenNow : shop?.status === 'open';
      setShopOpen(open);
      setNextOpenHint(shop?.nextOpenHint || null);
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

  const applyAddress = useCallback((addr: AddressItem | null) => {
    setSelectedAddress(addr);
    if (!addr) return;
    setAddress(addr.detail || '');
    setContactName(addr.contactName || '');
    setContactPhone(addr.contactPhone || '');
  }, []);

  const loadDefaultAddress = useCallback(async () => {
    if (!useAuthStore.getState().isLoggedIn) return;
    setAddressLoading(true);
    try {
      const res = await get<AddressItem[]>('/addresses', { shopId: DEFAULT_SHOP_ID }, { useCache: false });
      const list = res.data || [];
      const preferred = list.find((a) => a.isDefault) || list[0] || null;
      if (preferred) {
        applyAddress(preferred);
      }
    } catch (e) {
      console.error('加载默认地址失败:', e);
    } finally {
      setAddressLoading(false);
    }
  }, [applyAddress]);

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
    // 外卖默认地址
    loadDefaultAddress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 从地址簿返回时读取选中地址；登录后补拉默认地址
  useDidShow(() => {
    try {
      const picked = Taro.getStorageSync('tf_selected_address') as AddressItem | '';
      if (picked && typeof picked === 'object' && (picked as AddressItem).id) {
        applyAddress(picked as AddressItem);
        Taro.removeStorageSync('tf_selected_address');
        return;
      }
    } catch (e) {
      // ignore
    }
    // 尚未选中地址且已登录时，补拉默认地址（覆盖先打开页后登录的场景）
    if (!selectedAddress && useAuthStore.getState().isLoggedIn) {
      loadDefaultAddress();
    }
  });

  const openAddressBook = () => {
    if (!authLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      Taro.navigateTo({ url: '/pages/auth/login' });
      return;
    }
    Taro.navigateTo({
      url: '/pages/address/index?select=1',
      events: {
        addressSelected: (addr: AddressItem) => {
          applyAddress(addr);
        },
      },
    });
  };

  const goAddAddress = () => {
    if (!authLoggedIn) {
      Taro.navigateTo({ url: '/pages/auth/login' });
      return;
    }
    Taro.navigateTo({ url: '/pages/address/edit' });
  };

  /** 选择配送方式 */
  const selectDeliveryType = (type: DeliveryType) => {
    setDeliveryType(type);
    // 切到外卖且尚未选地址时，尝试带出默认地址
    if (type === DeliveryType.DELIVERY && !selectedAddress) {
      loadDefaultAddress();
    }
  };

  /** 提交订单 */
  const submitOrder = async () => {
    if (cartItems.length === 0) {
      Taro.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }
    if (!shopOpen) {
      Taro.showToast({ title: nextOpenHint || '店铺休息中，暂不可下单', icon: 'none' });
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

    if (invoiceNeeded && !isNonEmpty(invoiceTitle)) {
      Taro.showToast({ title: '请填写发票抬头', icon: 'none' });
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
          // 传规格选项 ID，后端用于校验/落库规格明细
          specOptionIds: item.specOptionIds || [],
        })),
        deliveryType,
        // deliveryFee 由服务端从店铺配置获取，不信任客户端传值
        address: deliveryType === DeliveryType.DELIVERY ? address : '',
        tableNo: (deliveryType === DeliveryType.DINE_IN || deliveryType === DeliveryType.PICKUP) ? tableNo : '',
        remark: cartRemarks || '',
        // 空值不传，避免后端把空串当有效手机号/联系人校验失败
        ...(isNonEmpty(contactName) ? { contactName: contactName.trim() } : {}),
        ...(isNonEmpty(contactPhone) ? { contactPhone: contactPhone.trim() } : {}),
        invoiceNeeded,
        ...(invoiceNeeded
          ? {
              invoiceTitle: invoiceTitle.trim(),
              ...(isNonEmpty(invoiceTaxNo) ? { invoiceTaxNo: invoiceTaxNo.trim() } : {}),
            }
          : {}),
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
        <SectionCard className='delivery-section' icon='order' title='配送方式'>
          <View className='delivery-type-list'>
            {([
              { type: DeliveryType.DELIVERY, icon: 'cart' as IconName, label: '外卖配送' },
              { type: DeliveryType.PICKUP, icon: 'shop' as IconName, label: '到店自取' },
              { type: DeliveryType.DINE_IN, icon: 'food' as IconName, label: '堂食' },
            ]).map((item) => (
              <View
                key={item.type}
                className={`delivery-type-card ${
                  deliveryType === item.type ? 'active' : ''
                }`}
                onClick={() => selectDeliveryType(item.type)}
              >
                <View className='delivery-type-card__icon'>
                  <Icon
                    name={item.icon}
                    size={22}
                    color={deliveryType === item.type ? '#FF6B35' : '#666666'}
                  />
                </View>
                <Text className='delivery-type-card__label'>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* 配送/桌号信息 */}
          <View className='delivery-info-form'>
            {deliveryType === DeliveryType.DELIVERY ? (
              <View className='address-book-block'>
                {addressLoading ? (
                  <Text className='address-book-block__hint'>地址加载中...</Text>
                ) : selectedAddress ? (
                  <View className='address-book-card' onClick={openAddressBook}>
                    <View className='address-book-card__row'>
                      <Text className='address-book-card__name'>{selectedAddress.contactName}</Text>
                      <Text className='address-book-card__phone'>{selectedAddress.contactPhone}</Text>
                      {selectedAddress.tag ? (
                        <Text className='address-book-card__badge soft'>{selectedAddress.tag}</Text>
                      ) : null}
                      {selectedAddress.isDefault ? (
                        <Text className='address-book-card__badge'>默认</Text>
                      ) : null}
                    </View>
                    <Text className='address-book-card__detail'>{selectedAddress.detail}</Text>
                    <Text className='address-book-card__switch'>切换地址 ›</Text>
                  </View>
                ) : (
                  <>
                    <View className='address-book-empty'>
                      <Text className='address-book-empty__text'>还没有收货地址，可新增或手动填写</Text>
                      <View className='address-book-empty__actions'>
                        <Text className='address-book-empty__btn' onClick={goAddAddress}>去新增</Text>
                        <Text className='address-book-empty__btn ghost' onClick={openAddressBook}>地址簿</Text>
                      </View>
                    </View>
                    <Input
                      className='form-input'
                      placeholder='请输入配送地址'
                      value={address}
                      onInput={(e) => setAddress(e.detail.value)}
                    />
                    <View className='form-row'>
                      <Input
                        className='form-input form-input--flex-1'
                        placeholder='姓名'
                        value={contactName}
                        onInput={(e) => setContactName(e.detail.value)}
                        aria-label='联系人姓名'
                      />
                      <Input
                        className='form-input form-input--flex-2'
                        placeholder='电话'
                        value={contactPhone}
                        onInput={(e) => setContactPhone(e.detail.value)}
                        aria-label='联系人电话'
                      />
                    </View>
                  </>
                )}
              </View>
            ) : deliveryType === DeliveryType.DINE_IN ? (
              <Input
                className='form-input'
                placeholder='请输入桌号（如 A06）'
                value={tableNo}
                onInput={(e) => setTableNo(e.detail.value)}
              />
            ) : (
              <View className='address-book-card address-book-card--shop'>
                <View className='address-book-card__row'>
                  <Text className='address-book-card__name'>{shopName || '门店'}</Text>
                  {shopPhone ? (
                    <Text className='address-book-card__phone'>{shopPhone}</Text>
                  ) : null}
                  <Text className='address-book-card__badge soft'>自取</Text>
                </View>
                <Text className='address-book-card__detail'>
                  {shopAddress || '门店地址暂未设置'}
                </Text>
                <Text className='address-book-card__switch'>请前往门店自取</Text>
              </View>
            )}
          </View>
        </SectionCard>

        {/* 优惠信息 */}
        {promotions.length > 0 && (
          <SectionCard className='promotion-section' icon='star' title='优惠活动'>
            {promotions.map((promo: Promotion) => {
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
                <View key={promo.id} className='promotion-loading'>
                  <Text>{promo.name}</Text>
                  <Text className='price-value--muted'>{desc}</Text>
                </View>
              );
            })}
          </SectionCard>
        )}

        {/* 商品列表 */}
        <SectionCard className='goods-section' icon='list' title={`已选菜品 (${cartItems.length}件)`}>
          <View className='goods-list'>
            {cartItems.map((item) => (
              <View key={item.key} className='goods-item'>
                <View className='goods-item__image'>
                  <FoodThumb src={item.imageUrl} name={item.name} size='sm' round />
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
        <SectionCard className='remark-section' icon='chat' title='备注'>
          <View className='remark-input-wrap'>
            <Input
              className='remark-input'
              placeholder=''
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

        {/* 发票信息 */}
        <SectionCard className='invoice-section' icon='invoice' title='发票信息'>
          <View className='invoice-switch-row'>
            <Text className='invoice-switch-row__label'>需要发票</Text>
            <Switch
              checked={invoiceNeeded}
              color='#FF6B35'
              onChange={(e) => setInvoiceNeeded(!!e.detail.value)}
            />
          </View>
          {invoiceNeeded && (
            <View className='invoice-fields'>
              <Input
                className='form-input'
                placeholder='发票抬头（必填）'
                value={invoiceTitle}
                onInput={(e) => setInvoiceTitle(e.detail.value)}
              />
              <Input
                className='form-input'
                placeholder='税号（选填）'
                value={invoiceTaxNo}
                onInput={(e) => setInvoiceTaxNo(e.detail.value)}
              />
            </View>
          )}
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
          {promotionsLoading && (
            <View className='price-item'>
              <Text className='price-label'>优惠计算中</Text>
              <Text className='price-value price-value--muted'>...</Text>
            </View>
          )}
        </SectionCard>
      </View>

      <FooterBar
        totalText={formatPriceWithSymbol(total)}
        actionText={submitting ? '提交中...' : !shopOpen ? '休息中' : '提交订单'}
        actionDisabled={submitting || !shopOpen}
        onAction={submitOrder}
      />
    </View>
  );
};

export default OrderConfirmPage;
