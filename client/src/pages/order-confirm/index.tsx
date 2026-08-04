import Icon, { type IconName } from '../../components/Icon';
import FoodThumb from '../../components/FoodThumb';
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { get, post } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol } from '../../utils/format';
import { DeliveryType } from '../../types/order';
import { getRemarkTagsByDeliveryType } from '../../utils/constants';
import { DEFAULT_SHOP_ID } from '../../env';
import { loadDineContext } from '../../utils/dine-context';
import { Promotion } from '../../types/promotion';
import { MenuItemStatus, type MenuItem } from '../../types/menu';
import SectionCard from '../../components/SectionCard';
import FooterBar from '../../components/FooterBar';
import { isNonEmpty } from '../../utils/validators';
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
  const removeItems = useCartStore((s) => s.removeItems);
  const setRemarks = useCartStore((s) => s.setRemarks);
  const getTotalPrice = useCartStore((s) => s.getTotalPrice);
  const authLoggedIn = useAuthStore((s) => s.isLoggedIn);

  // 本地状态
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.PICKUP);
  const [tableNo, setTableNo] = useState('');
  // §3.23 / T246.8：自取/堂食不再要求联系人/手机号（人已在店，店铺信息卡足以替代）
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
  const [addressCoordWarning, setAddressCoordWarning] = useState(false);

  const applySelectedAddress = (addr: AddressItem | null) => {
    if (
      addr &&
      (typeof addr.latitude !== 'number' || typeof addr.longitude !== 'number')
    ) {
      setSelectedAddress(null);
      setAddressCoordWarning(true);
      return;
    }
    setAddressCoordWarning(false);
    setSelectedAddress(addr);
  };

  const [addressLoading, setAddressLoading] = useState(false);

  const deliveryFee = deliveryType === DeliveryType.DELIVERY ? shopDeliveryFee : 0;

  // 用户手动选过配送方式后，扫码入座上下文不再回灌，
  // 否则从地址簿/登录页返回触发 useDidShow 会把已切走的堂食桌号又带回来（T246.2）
  const deliveryTypeTouchedRef = useRef(false);

  // 扫码入座上下文：默认堂食 + 桌号（每次显示时同步，避免从菜单清除桌号后仍沿用旧值）
  const applyDineContext = useCallback(() => {
    if (deliveryTypeTouchedRef.current) return;
    const ctx = loadDineContext();
    if (!ctx?.tableNo) return;
    setDeliveryType(DeliveryType.DINE_IN);
    setTableNo(ctx.tableNo);
  }, []);

  useEffect(() => {
    applyDineContext();
  }, [applyDineContext]);

  const loadShopInfo = useCallback(async () => {
    try {
      const res = await get<any>(`/shops/${cartShopId || DEFAULT_SHOP_ID}`);
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
      const res = await get<any[]>('/promotions', { shopId: cartShopId || DEFAULT_SHOP_ID });
      const activePromos = (res.data || []).filter((p: any) => p.status === 'active');
      setPromotions(activePromos);
    } catch (e) {
      console.error('加载优惠信息失败:', e);
    } finally {
      setPromotionsLoading(false);
    }
  }, []);

  const applyAddress = useCallback((addr: AddressItem | null) => {
    applySelectedAddress(addr);
  }, []);

  // 避免 useDidShow 闭包读到过期的 selectedAddress
  const selectedAddressRef = useRef<AddressItem | null>(null);
  selectedAddressRef.current = selectedAddress;
  // 并发去重：首屏/切配送/回页同时触发时只发一次请求
  const addressRequestRef = useRef<Promise<void> | null>(null);

  const loadDefaultAddress = useCallback(async () => {
    if (!useAuthStore.getState().isLoggedIn) return;
    if (addressRequestRef.current) return addressRequestRef.current;

    const request = (async () => {
      setAddressLoading(true);
      try {
        const res = await get<AddressItem[]>('/addresses', { shopId: cartShopId || DEFAULT_SHOP_ID }, { useCache: false });
        const list = res.data || [];
        const preferred = list.find((a) => a.isDefault) || list[0] || null;
        if (preferred) {
          applyAddress(preferred);
        } else {
          applySelectedAddress(null);
        }
      } catch (e) {
        console.error('加载默认地址失败:', e);
      } finally {
        setAddressLoading(false);
        addressRequestRef.current = null;
      }
    })();

    addressRequestRef.current = request;
    return request;
  }, [applyAddress, cartShopId]);

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
    // 默认地址改由 useDidShow 拉取，避免首屏 useEffect + useDidShow 双请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 首屏、从地址簿/登录返回时读取选中地址或补拉默认地址
  useDidShow(() => {
    applyDineContext();
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
    if (!selectedAddressRef.current && useAuthStore.getState().isLoggedIn) {
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
    deliveryTypeTouchedRef.current = true;
    setDeliveryType(type);
    // 切到外卖且尚未选地址时，尝试带出默认地址
    if (type === DeliveryType.DELIVERY && !selectedAddress) {
      loadDefaultAddress();
    }
    // T246.2: 切到自取/外卖时清空桌号残留，避免被提交
    if (type !== DeliveryType.DINE_IN) setTableNo('');
    // T246.2 反向：切到堂食时清掉已选配送地址，避免堂食单携带地址与坐标
    if (type === DeliveryType.DINE_IN) {
      setSelectedAddress(null);
      setAddressCoordWarning(false);
    }
  };

  /** 同步菜单可用性并清理失效菜品 */
  const syncCartAvailabilityBeforeSubmit = async (): Promise<boolean> => {
    const shopId = cartShopId || DEFAULT_SHOP_ID;
    let toastTitle = '';
    let shouldNavigateBack = false;
    Taro.showLoading({ title: '同步菜单', mask: true });
    try {
      const res = await get<MenuItem[]>('/menu-items', { shop_id: shopId }, {
        useCache: false,
        showError: false,
      });
      const activeItemIds = new Set(
        (res.data || [])
          .filter((item) => item.status === MenuItemStatus.ACTIVE)
          .map((item) => item.id),
      );
      const invalidItems = cartItems.filter((item) => !activeItemIds.has(item.menuItemId));
      if (invalidItems.length === 0) return true;

      removeItems(invalidItems.map((item) => item.key));
      if (invalidItems.length === cartItems.length) {
        toastTitle = '菜品已更新，请重新加购';
        shouldNavigateBack = true;
      } else {
        toastTitle = `已移除${invalidItems.length}个失效菜品，请确认`;
      }
      return false;
    } catch (error) {
      console.error('校验购物车菜品失败:', error);
      toastTitle = '菜单校验失败，请稍后重试';
      return false;
    } finally {
      Taro.hideLoading();
      if (toastTitle) {
        Taro.showToast({ title: toastTitle, icon: 'none', duration: 2000 });
      }
      if (shouldNavigateBack) {
        setTimeout(() => {
          Taro.navigateBack();
        }, 1500);
      }
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

    // 配送方式为外送时必须从地址簿选择
    if (deliveryType === DeliveryType.DELIVERY) {
      if (!selectedAddress) {
        Taro.showToast({ title: '请选择收货地址', icon: 'none' });
        return;
      }
      if (!isNonEmpty(selectedAddress.detail)) {
        Taro.showToast({ title: '收货地址不完整，请重新选择', icon: 'none' });
        return;
      }
      if (!isNonEmpty(selectedAddress.contactName)) {
        Taro.showToast({ title: '收货联系人不完整，请重新选择', icon: 'none' });
        return;
      }
      if (!isNonEmpty(selectedAddress.contactPhone)) {
        Taro.showToast({ title: '收货电话不完整，请重新选择', icon: 'none' });
        return;
      }
      if (
        typeof selectedAddress.latitude !== 'number'
        || typeof selectedAddress.longitude !== 'number'
      ) {
        Taro.showToast({ title: '地址缺少坐标，请重新地图选点', icon: 'none' });
        Taro.navigateTo({
          url: `/pages/address/edit?id=${selectedAddress.id}`,
        });
        return;
      }
    }

    // 堂食桌号必填
    if (deliveryType === DeliveryType.DINE_IN && !isNonEmpty(tableNo)) {
      Taro.showToast({ title: '请填写桌号', icon: 'none' });
      return;
    }
    // §3.23 / T246.8：自取/堂食不需要联系人和手机号（人已在店，店铺信息卡替代）

    await runSubmit(async () => {
      const canSubmit = await syncCartAvailabilityBeforeSubmit();
      if (!canSubmit) return;

      const latestCartItems = useCartStore.getState().items;
      if (latestCartItems.length === 0) {
        Taro.showToast({ title: '购物车为空', icon: 'none' });
        return;
      }

      const orderData = {
        shopId: cartShopId || DEFAULT_SHOP_ID,
        // 服务端校验菜品价格：仅传 menuItemId/quantity/specDesc，price 由后端从数据库查询
        // 避免客户端篡改 price 导致低价下单
        items: latestCartItems.map((item) => ({
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
        // T246.2: 仅堂食携带桌号，自取/外卖一律不传，避免切换配送方式后的桌号残留
        tableNo: deliveryType === DeliveryType.DINE_IN ? tableNo.trim() : '',
        // §3.23 / T246.8：仅外卖订单携带联系信息，自取/堂食到店核销，无需远程联系
        contactName:
          deliveryType === DeliveryType.DELIVERY
            ? selectedAddress?.contactName?.trim() || ''
            : '',
        contactPhone:
          deliveryType === DeliveryType.DELIVERY
            ? selectedAddress?.contactPhone?.trim() || ''
            : '',
        remark: cartRemarks || '',
        // 空值不传，避免后端把空串当有效手机号/联系人校验失败
        address: deliveryType === DeliveryType.DELIVERY
          ? (selectedAddress?.detail || '').trim()
          : '',
        ...(deliveryType === DeliveryType.DELIVERY
          && typeof selectedAddress?.latitude === 'number'
          && typeof selectedAddress?.longitude === 'number'
          ? {
              deliveryLatitude: selectedAddress.latitude,
              deliveryLongitude: selectedAddress.longitude,
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

  // T246.5: 备注快捷标签按配送类型区分（自取/堂食额外给出到店时间等标签）
  const remarkTags = getRemarkTagsByDeliveryType(deliveryType);

  return (
    <View className='order-confirm'>
      <View className='order-confirm__content'>
        {/* 配送方式 */}
        <SectionCard className='delivery-section' icon='delivery' title='配送方式'>
          <View className='delivery-type-list'>
            {([
              { type: DeliveryType.DELIVERY, icon: 'delivery' as IconName, label: '外卖配送' },
              { type: DeliveryType.PICKUP, icon: 'pickup' as IconName, label: '到店自取' },
              { type: DeliveryType.DINE_IN, icon: 'dine-in' as IconName, label: '堂食' },
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
                <Text className='form-field-label'>
                  收货地址
                  <Text className='form-required'>*</Text>
                </Text>
                {addressCoordWarning ? (
                  <View className='address-coord-warning' onClick={openAddressBook}>
                    <Text className='address-coord-warning__text'>
                      默认/所选地址缺少地图坐标，请完善或更换地址后再下单
                    </Text>
                    <Text className='address-coord-warning__action'>去处理 ›</Text>
                  </View>
                ) : null}
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
                  <View className='address-book-empty'>
                    <Text className='address-book-empty__text'>还没有收货地址，请先新增</Text>
                    <View className='address-book-empty__actions'>
                      <Text className='address-book-empty__btn' onClick={goAddAddress}>去新增</Text>
                      <Text className='address-book-empty__btn ghost' onClick={openAddressBook}>地址簿</Text>
                    </View>
                  </View>
                )}
              </View>
            ) : deliveryType === DeliveryType.DINE_IN ? (
              <View className='delivery-info-form'>
                <Text className='form-field-label'>
                  桌号
                  <Text className='form-required'>*</Text>
                </Text>
                <Input
                  className='form-input'
                  placeholder='请输入桌号（如 A06）'
                  value={tableNo}
                  onInput={(e) => setTableNo(e.detail.value)}
                />
                {/* §3.23 / T246.8：堂食不需要联系人/手机号（人已在店，店铺信息替代） */}
              </View>
            ) : (
              // 自取：仅展示店铺联系方式与地址，不要用户填联系信息
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
                <FoodThumb className='goods-item__thumb' src={item.imageUrl} name={item.name} size='sm' round />
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
              placeholder='请填写备注'
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