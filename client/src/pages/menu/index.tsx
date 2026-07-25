import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro, { createSelectorQuery } from '@tarojs/taro';
import { get, post, isRetryableError } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol } from '../../utils/format';
import { getCategoryIcon } from '../../utils/iconMap';
import { Shop } from '../../types/shop';
import { Category, MenuItem, SpecGroup, SpecOption } from '../../types/menu';
import { DEFAULT_SHOP_ID } from '../../env';
import {
  applyDineParamsFromRouter,
  clearDineContext,
  loadDineContext,
  type DineContext,
} from '../../utils/dine-context';
import SkeletonLoader from '../../components/SkeletonLoader';
import BottomSheet from '../../components/BottomSheet';
import EmptyState from '../../components/EmptyState';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import './index.scss';

import FlyInAnimation from '../../components/FlyInAnimation';
import MenuItemCard from '../../components/MenuItemCard';
import CartItemRow from '../../components/CartItemRow';

interface CategoryItemData {
  id: string;
  name: string;
  iconKey?: string;
  items: MenuItem[];
}

interface SpecOptionWithPrice extends SpecOption {
  isSelected: boolean;
}

interface SpecGroupWithSelection extends SpecGroup {
  selectedOptions: SpecOptionWithPrice[];
}

export default function MenuPage() {
  const cartStore = useCartStore();

  const [shop, setShop] = useState<Shop | null>(null);
  const [categories, setCategories] = useState<CategoryItemData[]>([]);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dineContext, setDineContext] = useState<DineContext | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [cartPopupVisible, setCartPopupVisible] = useState(false);
  const [specPopupVisible, setSpecPopupVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>({});
  const [selectedSpecOptionIds, setSelectedSpecOptionIds] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [flyInVisible, setFlyInVisible] = useState(false);
  const [flyInPosition, setFlyInPosition] = useState({ x: 0, y: 0 });
  const [itemSpecs, setItemSpecs] = useState<SpecGroupWithSelection[]>([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [scrollIntoView, setScrollIntoView] = useState('');
  const [specExtraPrice, setSpecExtraPrice] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchRequestRef = useRef(0); // 搜索请求序号，防止慢响应覆盖新结果
  const categoryOffsetsRef = useRef<number[]>([]);
  const scrollLockRef = useRef(false); // 点击分类滚动时锁定 scroll-spy，避免抖动
  const [sidebarScrollIntoView, setSidebarScrollIntoView] = useState('');

  // Refs to avoid stale closures in callbacks
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const selectedItemRef = useRef(selectedItem);
  selectedItemRef.current = selectedItem;
  const selectedSpecsRef = useRef(selectedSpecs);
  selectedSpecsRef.current = selectedSpecs;
  const selectedSpecOptionIdsRef = useRef(selectedSpecOptionIds);
  selectedSpecOptionIdsRef.current = selectedSpecOptionIds;
  const itemSpecsRef = useRef(itemSpecs);
  itemSpecsRef.current = itemSpecs;
  const quantityRef = useRef(quantity);
  quantityRef.current = quantity;


  // 扫码入座：解析 tableNo / scene，持久化堂食上下文
  useEffect(() => {
    try {
      const params = (Taro.getCurrentInstance().router?.params || {}) as Record<string, string | undefined>;
      const ctx = applyDineParamsFromRouter(params);
      setDineContext(ctx);
    } catch {
      setDineContext(loadDineContext());
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  usePullRefresh(loadData);

  async function loadData() {
    setLoading(true);
    setLoadError(false);
    setCanRetry(false);
    try {
      const [shopRes, categoriesRes, menuItemsRes, popularRes] = await Promise.all([
        get<Shop>(`/shops/${DEFAULT_SHOP_ID}`),
        get<Category[]>('/categories', { shop_id: DEFAULT_SHOP_ID }),
        get<MenuItem[]>('/menu-items', { shop_id: DEFAULT_SHOP_ID }),
        get<MenuItem[]>('/menu-items/popular', { shop_id: DEFAULT_SHOP_ID }),
      ]);

      const shopData = shopRes.data;
      const categoriesData = categoriesRes.data;
      const menuItemsData = menuItemsRes.data;
      const popularItems = popularRes.data || [];

      const categoryItems: CategoryItemData[] = categoriesData.map((cat) => ({
        id: cat.id,
        name: cat.name,
        iconKey: cat.iconKey,
        items: menuItemsData.filter((item) => item.categoryId === cat.id),
      }));

      if (popularItems.length > 0) {
        categoryItems.unshift({
          id: 'popular',
          name: '热门推荐',
          iconKey: 'hot',
          items: popularItems,
        });
      }

      setShop(shopData);
      setCategories(categoryItems);
      setLoadError(false);
      setCanRetry(false);
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
      setCategories([]);
      setLoadError(true);
      setCanRetry(isRetryableError(error));
      console.error('加载菜单失败:', error);
      Taro.showToast({ title: '加载菜单失败', icon: 'none' });
    }
  }

  function switchCategory(index: number) {
    const cats = categoriesRef.current;
    if (index < 0 || index >= cats.length) return;
    const catId = cats[index].id;
    setActiveCategoryIndex(index);
    // 微信 scroll-into-view 需先清空再设置才能重复触发
    setScrollIntoView('');
    scrollLockRef.current = true;
    setTimeout(() => {
      setScrollIntoView(`cat-${catId}`);
      setTimeout(() => {
        scrollLockRef.current = false;
      }, 360);
    }, 16);
  }

  /** 测量各分类区块相对菜单列表顶部的偏移，用于右侧滚动 → 左侧高亮 */
  const measureCategoryOffsets = useCallback(() => {
    const cats = categoriesRef.current;
    if (!cats.length) return;
    const query = createSelectorQuery();
    query.select('.menu-items').boundingClientRect();
    cats.forEach((cat) => {
      query.select(`#cat-${cat.id}`).boundingClientRect();
    });
    query.exec((res) => {
      if (!res || !res[0]) return;
      const listTop = res[0].top || 0;
      const offsets: number[] = [];
      for (let i = 1; i < res.length; i += 1) {
        const rect = res[i];
        if (!rect) {
          offsets.push(offsets[offsets.length - 1] || 0);
          continue;
        }
        offsets.push((rect.top || 0) - listTop);
      }
      categoryOffsetsRef.current = offsets;
    });
  }, []);

  useEffect(() => {
    if (loading || categories.length === 0) return;
    const timer = setTimeout(() => measureCategoryOffsets(), 80);
    return () => clearTimeout(timer);
  }, [loading, categories, measureCategoryOffsets]);

  const handleMenuScroll = useCallback((e: any) => {
    if (scrollLockRef.current) return;
    const scrollTop = e?.detail?.scrollTop || 0;
    const offsets = categoryOffsetsRef.current;
    if (!offsets.length) return;

    // 找到最后一个 offset <= scrollTop + 缓冲 的分类
    let nextIndex = 0;
    const threshold = scrollTop + 24;
    for (let i = 0; i < offsets.length; i += 1) {
      if (offsets[i] <= threshold) nextIndex = i;
      else break;
    }
    setActiveCategoryIndex((prev) => {
      if (prev === nextIndex) return prev;
      const catId = categoriesRef.current[nextIndex]?.id;
      if (catId) {
        setSidebarScrollIntoView('');
        setTimeout(() => setSidebarScrollIntoView(`side-cat-${catId}`), 16);
      }
      return nextIndex;
    });
  }, []);

  async function handleItemClick(item: MenuItem) {
    // 重置规格加价，避免新商品残留上一商品的加价
    setSpecExtraPrice(0);
    setLoadingSpecs(true);
    try {
      const specsRes = await get<SpecGroup[]>(`/menu-items/${item.id}/specs`);
      const specsData: SpecGroupWithSelection[] = (specsRes.data || []).map((sg) => ({
        ...sg,
        selectedOptions: sg.options.map((opt) => ({
          ...opt,
          isSelected: opt.isDefault,
        })),
      }));

      const defaultSpecs: Record<string, string> = {};
      const defaultOptionIds: Record<string, string> = {};
      specsData.forEach((sg) => {
        const defOpt = sg.options.find((o) => o.isDefault);
        if (defOpt) {
          defaultSpecs[sg.id] = defOpt.name;
          defaultOptionIds[sg.id] = defOpt.id;
        }
      });

      setSelectedItem(item);
      setSelectedSpecs(defaultSpecs);
      setSelectedSpecOptionIds(defaultOptionIds);
      setItemSpecs(specsData);
      setQuantity(1);
      setScrollIntoView('');
      setSpecPopupVisible(true);
      setLoadingSpecs(false);
    } catch (error) {
      console.error('加载规格失败:', error);
      setSelectedItem(item);
      setSelectedSpecs({});
      setSelectedSpecOptionIds({});
      setItemSpecs([]);
      setQuantity(1);
      setSpecPopupVisible(true);
      setLoadingSpecs(false);
    }
  }

  function selectSpec(groupId: string, optionId: string, optionName: string) {
    const currentSpecs = itemSpecsRef.current;
    const targetGroup = currentSpecs.find((sg) => sg.id === groupId);
    if (!targetGroup) return;

    const isMultiSelect = targetGroup.maxSelect > 1;
    const currentSelectedIds = Object.keys(selectedSpecOptionIdsRef.current)
      .filter((gid) => gid === groupId)
      .map(() => selectedSpecOptionIdsRef.current[groupId])
      .filter(Boolean);

    const newSpecs = currentSpecs.map((sg) => {
      if (sg.id !== groupId) return sg;

      if (isMultiSelect) {
        // 多选：toggle 选中状态，不超过 maxSelect
        const alreadySelected = currentSelectedIds.includes(optionId);
        // 多选场景下 isSelected 状态维护在 selectedOptions 上（SpecOptionWithPrice[]）
        const newOptions: SpecOptionWithPrice[] = sg.selectedOptions.map((opt) => {
          if (opt.id === optionId) {
            return { ...opt, isSelected: !opt.isSelected };
          }
          return opt;
        });
        // 如果当前选中数已达上限且是新选，不允许再选
        if (!alreadySelected && currentSelectedIds.length >= sg.maxSelect) {
          return sg; // 保持不变
        }
        return { ...sg, selectedOptions: newOptions };
      }

      // 单选：只有选中的为 true
      const newOptions: SpecOptionWithPrice[] = sg.selectedOptions.map((opt) => ({
        ...opt,
        isSelected: opt.id === optionId,
      }));
      return { ...sg, selectedOptions: newOptions };
    });

    // 计算新的规格加价
    let newSpecExtraPrice = 0;
    newSpecs.forEach((sg) => {
      sg.selectedOptions.forEach((opt) => {
        if (opt.isSelected) newSpecExtraPrice += opt.priceAdjust || 0;
      });
    });
    setSpecExtraPrice(newSpecExtraPrice);

    setItemSpecs(newSpecs);

    // 更新选中的规格（多选用逗号分隔名称，单选直接用名称）
    if (isMultiSelect) {
      const selectedNames = newSpecs
        .find((sg) => sg.id === groupId)?.selectedOptions
        .filter((o) => o.isSelected)
        .map((o) => o.name) || [];
      setSelectedSpecs({ ...selectedSpecsRef.current, [groupId]: selectedNames.join(',') });
      const selectedIds = newSpecs
        .find((sg) => sg.id === groupId)?.selectedOptions
        .filter((o) => o.isSelected)
        .map((o) => o.id) || [];
      setSelectedSpecOptionIds({ ...selectedSpecOptionIdsRef.current, [groupId]: selectedIds.join(',') });
    } else {
      setSelectedSpecs({ ...selectedSpecsRef.current, [groupId]: optionName });
      setSelectedSpecOptionIds({ ...selectedSpecOptionIdsRef.current, [groupId]: optionId });
    }
  }

  async function addToCart() {
    if (addingToCart) return;
    const item = selectedItemRef.current;
    if (!item) return;
    setAddingToCart(true);

    const qty = quantityRef.current;
    const specs = selectedSpecsRef.current;
    const specOptionIds = selectedSpecOptionIdsRef.current;
    const specsData = itemSpecsRef.current;

    // 验证必选规格
    const missingSpecs = specsData
      .filter((sg) => sg.isRequired && !specOptionIds[sg.id])
      .map((sg) => sg.name);
    if (missingSpecs.length > 0) {
      Taro.showToast({ title: `请选择${missingSpecs.join('、')}`, icon: 'none' });
      setAddingToCart(false);
      return;
    }

    const specDesc = Object.values(specs).filter(Boolean).join('、');

    // 计算规格加价
    let specExtraPrice = 0;
    specsData.forEach((sg) => {
      const selOpt = sg.options.find((o) => o.id === specOptionIds[sg.id]);
      if (selOpt) specExtraPrice += selOpt.priceAdjust || 0;
    });

    const finalPrice = item.price + specExtraPrice;

    cartStore.addItem({
      menuItemId: item.id,
      name: item.name,
      price: finalPrice,
      quantity: qty,
      specDesc: specDesc || '',
      // 传 specOptionIds 用于生成稳定的唯一 key（避免规格描述顺序不同导致 key 冲突）
      specOptionIds: Object.values(specOptionIds).filter(Boolean),
      imageUrl: item.imageUrl || '',
    });

    // 触发动画 - 避免在回调中捕获 this/store 引用
    setTimeout(() => {
      const query = createSelectorQuery();
      query.select('.spec-popup__add-cart-btn').boundingClientRect((rect: any) => {
        if (rect && !Array.isArray(rect)) {
          setFlyInVisible(true);
          setFlyInPosition({ x: rect.left, y: rect.top });
          setTimeout(() => {
            setFlyInVisible(false);
          }, 600);
        }
      }).exec();
    }, 100);

    Taro.showToast({ title: '已加入购物车', icon: 'success', duration: 1000 });
    setSpecPopupVisible(false);
    setAddingToCart(false);
  }

  function handleSearch(keyword: string) {
    setSearchKeyword(keyword);
    
    // 清除之前的定时器
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    if (!keyword.trim()) {
      loadData();
      return;
    }
    
    // 300ms 防抖
    searchTimerRef.current = setTimeout(() => {
      searchItems(keyword);
    }, 300);
  }

  async function searchItems(keyword: string) {
    // 递增请求序号，仅处理最新请求的结果，避免慢响应覆盖新结果
    const requestId = ++searchRequestRef.current;
    try {
      const res = await get<MenuItem[]>('/menu-items', { shop_id: DEFAULT_SHOP_ID, search: keyword });
      if (requestId !== searchRequestRef.current) return; // 已有更新的请求，丢弃旧结果
      const menuItemsData = res.data;
      const cats = categoriesRef.current;
      const searchedCategories = cats.map((cat) => ({
        ...cat,
        items: menuItemsData.filter((item) => item.categoryId === cat.id),
      }));
      setCategories(searchedCategories);
    } catch (error) {
      if (requestId !== searchRequestRef.current) return;
      console.error('搜索失败:', error);
      Taro.showToast({ title: '搜索失败，请稍后重试', icon: 'none' });
    }
  }

  async function toggleFavorite(item: MenuItem) {
    const authState = useAuthStore.getState();
    if (!authState.isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    try {
      const res = await post<{ isFavorite: boolean }>('/favorites/toggle', {
        menuItemId: item.id,
        shopId: DEFAULT_SHOP_ID,
      });
      const nextFavorite = res.data?.isFavorite ?? !item.isFavorite;
      Taro.showToast({ title: nextFavorite ? '已收藏' : '已取消收藏', icon: 'success' });

      const cats = categoriesRef.current;
      const newCategories = cats.map(cat => ({
        ...cat,
        items: cat.items.map(i => i.id === item.id ? { ...i, isFavorite: nextFavorite } : i)
      }));
      setCategories(newCategories);
    } catch (e) {
      console.error('收藏操作失败:', e);
      Taro.showToast({ title: '收藏操作失败', icon: 'none' });
    }
  }

  function clearSearch() {
    setSearchKeyword('');
    setShowSearch(false);
    loadData();
  }

  function getItemBgColor(categoryIndex: number): string {
    const bgClasses = [
      'emoji-bg-hot', 'emoji-bg-meat', 'emoji-bg-veg',
      'emoji-bg-drink', 'emoji-bg-rice',
    ];
    return bgClasses[categoryIndex % bgClasses.length];
  }

  const getItemBgColorCb = useCallback(getItemBgColor, []);

  function getItemEmoji(name: string): string {
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

  const getItemEmojiCb = useCallback(getItemEmoji, []);

  function getSelectedSpecDesc(): string {
    const specsData = itemSpecsRef.current;
    const optIds = selectedSpecOptionIdsRef.current;
    const selectedNames: string[] = [];
    specsData.forEach(group => {
      const optionId = optIds[group.id];
      const option = group.options.find(opt => opt.id === optionId);
      if (option) {
        selectedNames.push(option.name);
      }
    });
    return selectedNames.join(' · ');
  }

  const cartItems = cartStore.items;
  const cartTotal = cartStore.getTotalPrice();
  const cartCount = cartStore.items.reduce((s, i) => s + i.quantity, 0);
  // 兼容旧逻辑：显式 isOpenNow 优先，否则回退 status
  const shopOpen =
    typeof shop?.isOpenNow === 'boolean' ? shop.isOpenNow : shop?.status === 'open';

  return (
    <View className='page menu-page'>
      {/* 顶部店铺信息 */}
      <View className='menu-header'>
        <View className='menu-header__avatar'>🏪</View>
        <View className='menu-header__info'>
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <View className='menu-header__title-row'>
              <Text className='menu-header__name'>{shop?.name || '小买卖烧烤'}</Text>
              <View
                className={`menu-header__open-badge${shopOpen ? '' : ' menu-header__open-badge--closed'}`}
              >
                <Text>{shopOpen ? '营业中' : '休息中'}</Text>
              </View>
            </View>
            <View className='menu-header__actions'>
              <View
                className='menu-header__status'
                onClick={() => {
                  const authState = useAuthStore.getState();
                  if (!authState.isLoggedIn) {
                    Taro.showToast({ title: '请先登录', icon: 'none' });
                    return;
                  }
                  Taro.navigateTo({ url: '/pages/favorites/index' });
                }}
                aria-label='我的收藏'
              >
                <Text>❤️ 收藏</Text>
              </View>
              <View
                className='menu-header__status'
                onClick={() => {
                  const authState = useAuthStore.getState();
                  if (!authState.isLoggedIn) {
                    Taro.showToast({ title: '请先登录', icon: 'none' });
                    return;
                  }
                  Taro.navigateTo({ url: '/pages/address/index' });
                }}
                aria-label='地址簿'
              >
                <Text>📍 地址</Text>
              </View>
              <View
                className='menu-header__status'
                onClick={() => setShowSearch(!showSearch)}
                aria-label={showSearch ? '关闭搜索' : '打开搜索'}
              >
                <Text>{showSearch ? '✕ 搜索' : '🔍 搜索'}</Text>
              </View>
            </View>
          </View>
          <Text className='menu-header__desc'>{shop?.description || '秘制烤肉，真材实料'}</Text>
          {!shopOpen && (
            <Text className='menu-header__rest-hint'>
              {shop?.nextOpenHint || '店铺休息中，暂不可下单'}
            </Text>
          )}
        </View>
      </View>

      {showSearch && (
        <View className='menu-page__search-bar'>
          <Input
            className='menu-page__search-input'
            placeholder='搜索菜品'
            value={searchKeyword}
            onInput={(e) => handleSearch(e.detail.value)}
            confirm-type='search'
            aria-label='搜索菜品'
          />
        </View>
      )}

      {loading ? (
        <SkeletonLoader mode='list' count={5} />
      ) : loadError ? (
        <EmptyState
          icon='⚠️'
          title='加载失败'
          description={canRetry ? '网络不稳定，请重试' : '菜单暂时无法获取'}
          actionText={canRetry ? '点击重试' : '重新加载'}
          onAction={() => loadData()}
        />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={searchKeyword.trim() ? '🔍' : '🍽️'}
          title={searchKeyword.trim() ? '未找到相关菜品' : '暂无菜品'}
          description={searchKeyword.trim() ? '换个关键词试试吧' : '商家正在准备菜单，请稍后再来'}
          actionText={searchKeyword.trim() ? '清空搜索' : undefined}
          onAction={searchKeyword.trim() ? clearSearch : undefined}
        />
      ) : !categories.some((cat) => cat.items.length > 0) ? (
        <EmptyState
          icon={searchKeyword.trim() ? '🔍' : '🍽️'}
          title={searchKeyword.trim() ? '未找到相关菜品' : '暂无菜品'}
          description={searchKeyword.trim() ? '换个关键词试试吧' : '商家正在准备菜单，请稍后再来'}
          actionText={searchKeyword.trim() ? '清空搜索' : undefined}
          onAction={searchKeyword.trim() ? clearSearch : undefined}
        />
      ) : (
        <>
      {dineContext?.tableNo ? (
        <View className='dine-banner' aria-label={`当前桌号 ${dineContext.tableNo}`}>
          <View className='dine-banner__text'>
            <Text className='dine-banner__title'>🍽️ 堂食桌号 {dineContext.tableNo}</Text>
            <Text className='dine-banner__sub'>扫码入座已识别，结算将默认堂食</Text>
          </View>
          <Text
            className='dine-banner__clear'
            onClick={() => {
              clearDineContext();
              setDineContext(null);
              Taro.showToast({ title: '已清除桌号', icon: 'none' });
            }}
          >
            清除
          </Text>
        </View>
      ) : null}

      <View className='menu-body'>
          {/* 左侧分类侧边栏 */}
          <ScrollView
            className='category-sidebar'
            scrollY
            scrollIntoView={sidebarScrollIntoView}
            scrollWithAnimation
            enhanced
            showScrollbar={false}
          >
            {categories.map((cat, index) => (
              <View
                key={cat.id}
                id={`side-cat-${cat.id}`}
                className={`category-sidebar__item ${index === activeCategoryIndex ? 'category-sidebar__item--active' : ''}`}
                onClick={() => switchCategory(index)}
                aria-label={`分类 ${cat.name}`}
              >
                <Text className='category-sidebar__icon'>
                  {getCategoryIcon(cat.iconKey || cat.name)}
                </Text>
                <Text className='category-sidebar__name'>{cat.name}</Text>
              </View>
            ))}
          </ScrollView>

          {/* 右侧菜品列表 */}
          <ScrollView
            className='menu-items'
            scrollY
            scrollIntoView={scrollIntoView}
            scrollWithAnimation
            enhanced
            showScrollbar={false}
            onScroll={handleMenuScroll}
            onScrollToUpper={() => !scrollLockRef.current && setActiveCategoryIndex(0)}
          >
            <View className='menu-items__content'>
              {categories.map((cat, index) => (
                <View key={cat.id} id={`cat-${cat.id}`}>
                  <Text className='category-title'>{cat.name}</Text>
                  {cat.items.length === 0 ? (
                    <View className='menu-page__empty-item' aria-label='该分类暂无菜品'>
                      {searchKeyword.trim() ? '未找到相关菜品' : '暂无菜品'}
                    </View>
                  ) : (
                    cat.items.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        categoryIndex={index}
                        onItemClick={handleItemClick}
                        onFavorite={toggleFavorite}
                        getItemBgColor={getItemBgColorCb}
                        getItemEmoji={getItemEmojiCb}
                      />
                    ))
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
        </>
      )}

      {/* 购物车弹出层（公共 BottomSheet） */}
      <BottomSheet
        visible={cartPopupVisible}
        onClose={() => setCartPopupVisible(false)}
        title='购物车'
      >
        <View className='cart-popup cart-popup--embedded'>
          <View className='cart-popup__header'>
            <View className='cart-popup__clear' onClick={() => cartStore.clearCart()}>
              清空
            </View>
          </View>
          <View className='cart-popup__body'>
            {cartItems.length === 0 ? (
              <EmptyState
                icon='🛒'
                title='购物车空空如也'
                description='去挑选几道好菜吧'
                actionText='去点餐'
                onAction={() => setCartPopupVisible(false)}
              />
            ) : (
              cartItems.map((item) => (
                <CartItemRow
                  key={item.key}
                  item={item}
                  onUpdateQuantity={(key, delta) => cartStore.updateQuantity(key, delta)}
                />
              ))
            )}
          </View>
        </View>
      </BottomSheet>

      {/* 规格选择弹窗（公共 BottomSheet） */}
      <BottomSheet
        visible={!!(specPopupVisible && selectedItem)}
        onClose={() => setSpecPopupVisible(false)}
        title={selectedItem?.name || '选择规格'}
      >
        {selectedItem && (
            <View className='spec-popup'>
              <View className='spec-popup__header'>
                <View className={`spec-popup__image ${getItemBgColor(activeCategoryIndex)}`}>
                  <Text style={{ fontSize: 36 }}>{getItemEmoji(selectedItem.name)}</Text>
                </View>
                <View className='spec-popup__info'>
                  <Text className='spec-popup__name'>{selectedItem.name}</Text>
                  <Text className='spec-popup__desc'>{selectedItem.description || '精选食材，美味秘制'}</Text>
                  <View className='spec-popup__price-row'>
                    <Text className='spec-popup__price'>
                      <Text className='spec-popup__price-unit'>¥</Text>
                      {formatPriceWithSymbol(selectedItem.price).replace('¥', '')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 规格选项渲染 */}
              <View className='spec-popup__content'>
                {loadingSpecs ? (
                  <View className='spec-popup__loading'>加载中...</View>
                ) : itemSpecs.length > 0 ? (
                  <View className='spec-popup__groups'>
                    {itemSpecs.map((sg) => (
                      <View key={sg.id} className='spec-group'>
                        <View className='spec-group__header'>
                          <Text className='spec-group__name'>{sg.name}</Text>
                          {sg.isRequired && (
                            <View className='spec-group__required-tag'>
                              <Text className='spec-group__required-star'>*</Text>
                              <Text className='spec-group__required-text'>必选</Text>
                            </View>
                          )}
                        </View>
                        <View className='spec-group__options'>
                          {sg.options.map((opt) => (
                            <View
                              key={opt.id}
                              className={`spec-option ${selectedSpecOptionIds[sg.id] === opt.id ? 'selected' : ''}`}
                              onClick={() => selectSpec(sg.id, opt.id, opt.name)}
                            >
                              <Text className='spec-option__name'>{opt.name}</Text>
                              {opt.priceAdjust > 0 && (
                                <Text className='spec-option__price'>+¥{opt.priceAdjust / 100}</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              {/* 已选展示 */}
              <View className='spec-popup__selected'>
                <Text className='spec-popup__selected-label'>已选：</Text>
                <Text className='spec-popup__selected-value'>{getSelectedSpecDesc()}</Text>
              </View>

              {/* 数量选择 */}
              <View className='spec-popup__qty-section'>
                <Text className='spec-popup__qty-label'>数量</Text>
                <View className='spec-popup__qty-controls'>
                  <View className='spec-popup__qty-btn' onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</View>
                  <Text className='spec-popup__qty-value'>{quantity}</Text>
                  <View className='spec-popup__qty-btn' onClick={() => setQuantity(quantity + 1)}>+</View>
                </View>
              </View>

              <View className='spec-popup__footer'>
                <View className='spec-popup__footer-left'>
                  <Text className='spec-popup__subtotal-label'>合计：</Text>
                  <Text className='spec-popup__subtotal-price'>
                    {formatPriceWithSymbol((selectedItem.price + specExtraPrice) * quantity)}
                  </Text>
                </View>
                <View
                  className={`spec-popup__add-cart-btn${addingToCart ? ' disabled' : ''}`}
                  onClick={addToCart}
                >
                  {addingToCart ? '加入中...' : '加入购物车'}
                </View>
              </View>
            </View>
        )}
      </BottomSheet>

      {/* 飞入动画 */}
      <FlyInAnimation visible={flyInVisible} />
      {flyInVisible && (
        <View
          className='fly-in-target'
          style={{
            position: 'fixed',
            left: flyInPosition.x - 18,
            top: flyInPosition.y - 18,
            zIndex: 9999,
            animation: 'flyIn 0.6s ease-in-out forwards',
            pointerEvents: 'none',
          }}
        >
          <Text style={{ fontSize: 36 }}>🛒</Text>
        </View>
      )}

      {/* 底部购物车栏 */}
      {cartCount > 0 && (
        <View className='cart-bar' onClick={() => setCartPopupVisible(!cartPopupVisible)}>
          <View className='cart-bar__icon-wrap'>
            <Text className='cart-bar__icon'>🛒</Text>
            <View className='cart-bar__badge'>
              <Text className='cart-bar__badge-text'>
                {cartCount}
              </Text>
            </View>
          </View>
          <View className='cart-bar__info'>
            <View className='cart-bar__price-wrap'>
              <Text className='cart-bar__total'>{formatPriceWithSymbol(cartTotal)}</Text>
              <Text className='cart-bar__note'>
                {shop?.deliveryFee ? `另需配送费 ${formatPriceWithSymbol(shop.deliveryFee)}` : ''}
              </Text>
            </View>
            <View
              className={`cart-bar__btn${!shopOpen ? ' cart-bar__btn--disabled' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!shopOpen) {
                  Taro.showToast({
                    title: shop?.nextOpenHint || '店铺休息中，暂不可下单',
                    icon: 'none',
                  });
                  return;
                }
                Taro.navigateTo({ url: '/pages/order-confirm/index' });
              }}
            >
              {shopOpen ? '去结算' : '休息中'}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
