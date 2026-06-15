import { Component } from 'react';
import { View, Text, ScrollView, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { get } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { formatPriceWithSymbol } from '../../utils/format';
import { getCategoryIcon } from '../../utils/iconMap';
import { Shop } from '../../types/shop';
import { Category, MenuItem } from '../../types/menu';
import { ApiResponse } from '../../types/api';
import './index.scss';

interface CategoryItemData {
  id: string;
  name: string;
  iconKey?: string;
  items: MenuItem[];
}

interface MenuPageState {
  shop: Shop | null;
  categories: CategoryItemData[];
  activeCategoryIndex: number;
  loading: boolean;
  cartPopupVisible: boolean;
  specPopupVisible: boolean;
  selectedItem: MenuItem | null;
  selectedSpecs: Record<string, string>;
  quantity: number;
}

export default class MenuPage extends Component<{}, MenuPageState> {
  private cartStore = useCartStore;

  constructor(props: {}) {
    super(props);

    this.state = {
      shop: null,
      categories: [],
      activeCategoryIndex: 0,
      loading: true,
      cartPopupVisible: false,
      specPopupVisible: false,
      selectedItem: null,
      selectedSpecs: {},
      quantity: 1,
    };
  }

  componentDidMount() {
    this.loadData();
  }

  async loadData() {
    this.setState({ loading: true });

    try {
      const defaultShopId = '00000000-0000-0000-0000-000000000001';

      // 并行获取店铺和菜单数据
      const [shopRes, categoriesRes, menuItemsRes] = await Promise.all([
        get<Shop>(`/shops/${defaultShopId}`),
        get<Category[]>(`/categories?shop_id=${defaultShopId}`),
        get<MenuItem[]>(`/menu-items?shop_id=${defaultShopId}`),
      ]);

      const shop = shopRes.data;
      const categories = categoriesRes.data;
      const menuItems = menuItemsRes.data;

      // 构建分类 + 菜品数据结构
      const categoryItems: CategoryItemData[] = categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        iconKey: cat.iconKey,
        items: menuItems.filter((item) => item.categoryId === cat.id),
      }));

      this.setState({
        shop,
        categories: categoryItems,
        loading: false,
      });
    } catch (error: any) {
      this.setState({ loading: false });
      console.error('加载菜单失败:', error);
    }
  }

  /** 切换分类 */
  switchCategory(index: number) {
    this.setState({ activeCategoryIndex: index });
  }

  /** 点击菜品 -> 打开规格选择弹窗 */
  handleItemClick(item: MenuItem) {
    const defaultSpecs: Record<string, string> = {};
    this.setState({
      selectedItem: item,
      selectedSpecs: defaultSpecs,
      quantity: 1,
      specPopupVisible: true,
    });
  }

  /** 选择规格 */
  selectSpec(groupId: string, optionName: string) {
    this.setState((prev) => ({
      selectedSpecs: { ...prev.selectedSpecs, [groupId]: optionName },
    }));
  }

  /** 加入购物车 */
  addToCart() {
    const { selectedItem, quantity } = this.state;
    if (!selectedItem) return;

    const specDesc = Object.values(this.state.selectedSpecs).join('、');

    this.cartStore.getState().addItem({
      menuItemId: selectedItem.id,
      name: selectedItem.name,
      price: selectedItem.price,
      quantity,
      specDesc: specDesc || undefined,
      imageUrl: selectedItem.imageUrl,
    });

    Taro.showToast({ title: '已加入购物车', icon: 'success', duration: 1000 });
    this.setState({ specPopupVisible: false });
  }

  /** 获取菜品背景色 */
  getItemBgColor(categoryIndex: number): string {
    const bgClasses = [
      'emoji-bg-hot',
      'emoji-bg-meat',
      'emoji-bg-veg',
      'emoji-bg-drink',
      'emoji-bg-rice',
    ];
    return bgClasses[categoryIndex % bgClasses.length];
  }

  /** 获取菜品 Emoji */
  getItemEmoji(name: string): string {
    const meatKeywords = ['烤羊排', '烤鸡翅', '牛肉', '羊肉', '排骨', '鸡胗', '大虾', '鸡翅', '烤串', '鱿鱼'];
    const vegKeywords = ['茄子', '金针菇', '韭菜', '土豆', '玉米'];
    const drinkKeywords = ['可乐', '雪碧', '啤酒', '矿泉水', '酸梅'];
    const riceKeywords = ['冷面', '馒头', '面包'];

    if (meatKeywords.some((k) => name.includes(k))) return '🥩';
    if (vegKeywords.some((k) => name.includes(k))) return '🥬';
    if (drinkKeywords.some((k) => name.includes(k))) return '🥤';
    if (riceKeywords.some((k) => name.includes(k))) return '🍚';
    return '🍽️';
  }

  render() {
    const {
      shop,
      categories,
      activeCategoryIndex,
      loading,
      cartPopupVisible,
      specPopupVisible,
      selectedItem,
      selectedSpecs,
      quantity,
    } = this.state;

    const cartState = this.cartStore.getState();
    const cartItems = cartState.items;
    const totalCount = cartState.getTotalCount();
    const totalPrice = cartState.getTotalPrice();

    return (
      <View className='menu-page' style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* 店铺头部 */}
        {shop && (
          <View className='menu-header'>
            <View className='menu-header__avatar'>🏪</View>
            <View className='menu-header__info'>
              <View style={{ display: 'flex', alignItems: 'center' }}>
                <Text className='menu-header__name'>{shop.name}</Text>
                <Text className='menu-header__status'>
                  {shop.status === 'open' ? '营业中' : '休息中'}
                </Text>
              </View>
              <Text className='menu-header__desc'>{shop.description}</Text>
            </View>
          </View>
        )}

        {/* 加载状态 */}
        {loading ? (
          <View className='loading-container'>
            <Text>加载中...</Text>
          </View>
        ) : (
          <View className='menu-body'>
            {/* 左侧分类栏 */}
            <ScrollView
              className='category-sidebar'
              scrollY
              enhanced
              showScrollbar={false}
            >
              {categories.map((cat, index) => (
                <View
                  key={cat.id}
                  className={`category-sidebar__item ${
                    index === activeCategoryIndex
                      ? 'category-sidebar__item--active'
                      : ''
                  }`}
                  onClick={() => this.switchCategory(index)}
                >
                  <Text className='category-sidebar__icon'>{getCategoryIcon(cat.iconKey)}</Text>
                  <Text className='category-sidebar__name'>{cat.name}</Text>
                </View>
              ))}
            </ScrollView>

            {/* 右侧菜品列表 */}
            <ScrollView
              className='menu-items'
              scrollY
              enhanced
              showScrollbar={false}
            >
              {categories.map((cat, catIndex) => (
                <View key={cat.id}>
                  <Text className='category-title'>{cat.name}</Text>
                  {cat.items.map((item) => (
                    <View
                      key={item.id}
                      className='menu-item-card'
                      onClick={() => this.handleItemClick(item)}
                    >
                      <View
                        className={`menu-item-card__image ${this.getItemBgColor(catIndex)}`}
                      >
                        <Text>{this.getItemEmoji(item.name)}</Text>
                      </View>
                      <View className='menu-item-card__info'>
                        <View>
                          <Text className='menu-item-card__name'>
                            {item.name}
                          </Text>
                          {item.description && (
                            <Text className='menu-item-card__desc'>
                              {item.description}
                            </Text>
                          )}
                        </View>
                        <View className='menu-item-card__bottom'>
                          <Text className='menu-item-card__price'>
                            <Text className='menu-item-card__price-unit'>¥</Text>
                            {formatPriceWithSymbol(item.price).replace('¥', '')}
                          </Text>
                          <Text className='menu-item-card__sales'>
                            月售{item.salesCount}
                          </Text>
                          <View
                            className='menu-item-card__add-btn'
                            onClick={(e) => {
                              e.stopPropagation();
                              this.handleItemClick(item);
                            }}
                          >
                            +
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 底部购物车栏 */}
        <View
          className='cart-bar'
          onClick={() => {
            if (cartItems.length > 0) {
              this.setState({ cartPopupVisible: true });
            }
          }}
        >
          <View className='cart-bar__icon-wrap'>
            <Text className='cart-bar__icon'>🛒</Text>
            {totalCount > 0 && (
              <Text className='cart-bar__badge'>
                {totalCount > 99 ? '99+' : totalCount}
              </Text>
            )}
          </View>
          <View className='cart-bar__info'>
            <Text className='cart-bar__total'>
              {totalCount > 0
                ? formatPriceWithSymbol(totalPrice)
                : '购物车是空的'}
            </Text>
            {totalCount > 0 && (
              <Text className='cart-bar__note'>
                另需配送费 ¥5.00
              </Text>
            )}
          </View>
          <View
            className={`cart-bar__btn ${
              totalCount === 0 ? 'cart-bar__btn--disabled' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (totalCount > 0) {
                Taro.navigateTo({ url: '/pages/order-confirm/index' });
              }
            }}
          >
            去结算
          </View>
        </View>

        {/* 购物车弹出层 */}
        {cartPopupVisible && (
          <View
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 200,
            }}
            onClick={() => this.setState({ cartPopupVisible: false })}
          >
            <View
              style={{
                position: 'absolute',
                bottom: 80,
                left: 12,
                right: 12,
                background: '#fff',
                borderRadius: 16,
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <View className='cart-popup__header'>
                <Text className='cart-popup__title'>购物车</Text>
                <View
                  className='cart-popup__clear'
                  onClick={() => {
                    this.cartStore.getState().clearCart();
                    this.setState({ cartPopupVisible: false });
                  }}
                >
                  清空
                </View>
              </View>
              <View className='cart-popup__list'>
                {cartItems.length === 0 ? (
                  <View style={{ textAlign: 'center', padding: '30px 0', color: '#999' }}>
                    <Text>购物车空空如也</Text>
                  </View>
                ) : (
                  cartItems.map((item) => (
                    <View key={item.key} className='cart-popup__item'>
                      <View className='cart-popup__item-info'>
                        <Text className='cart-popup__item-name'>{item.name}</Text>
                        {item.specDesc && (
                          <Text className='cart-popup__item-spec'>{item.specDesc}</Text>
                        )}
                      </View>
                      <Text className='cart-popup__item-price'>
                        {formatPriceWithSymbol(item.price)}
                      </Text>
                      <View className='cart-popup__item-actions'>
                        <View
                          className='cart-popup__qty-btn'
                          onClick={() =>
                            this.cartStore.getState().updateQuantity(item.key, -1)
                          }
                        >
                          -
                        </View>
                        <Text className='cart-popup__qty'>{item.quantity}</Text>
                        <View
                          className='cart-popup__qty-btn'
                          onClick={() =>
                            this.cartStore.getState().updateQuantity(item.key, 1)
                          }
                        >
                          +
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        )}

        {/* 规格选择弹窗 */}
        {specPopupVisible && selectedItem && (
          <View
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 300,
            }}
            onClick={() => this.setState({ specPopupVisible: false })}
          >
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: '#fff',
                borderRadius: '16px 16px 0 0',
                maxHeight: '70vh',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <View className='spec-popup'>
                <View className='spec-popup__header'>
                  <View
                    className={`spec-popup__image ${this.getItemBgColor(activeCategoryIndex)}`}
                  >
                    <Text style={{ fontSize: 36 }}>
                      {this.getItemEmoji(selectedItem.name)}
                    </Text>
                  </View>
                  <View className='spec-popup__info'>
                    <Text className='spec-popup__price'>
                      <Text className='spec-popup__price-unit'>¥</Text>
                      {formatPriceWithSymbol(selectedItem.price).replace('¥', '')}
                    </Text>
                    <Text className='spec-popup__sales'>
                      月售{selectedItem.salesCount}
                    </Text>
                    <View
                      className='cart-popup__item-actions'
                      style={{ marginTop: 8 }}
                    >
                      <View
                        className='cart-popup__qty-btn'
                        onClick={() =>
                          this.setState((prev) => ({
                            quantity: Math.max(1, prev.quantity - 1),
                          }))
                        }
                      >
                        -
                      </View>
                      <Text className='cart-popup__qty'>{quantity}</Text>
                      <View
                        className='cart-popup__qty-btn'
                        onClick={() =>
                          this.setState((prev) => ({
                            quantity: prev.quantity + 1,
                          }))
                        }
                      >
                        +
                      </View>
                    </View>
                  </View>
                </View>

                <View className='spec-popup__footer'>
                  <Text className='spec-popup__subtotal'>
                    小计:{' '}
                    <Text className='spec-popup__subtotal-price'>
                      {formatPriceWithSymbol(selectedItem.price * quantity)}
                    </Text>
                  </Text>
                  <View
                    className='spec-popup__add-cart'
                    onClick={() => this.addToCart()}
                  >
                    加入购物车
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }
}
