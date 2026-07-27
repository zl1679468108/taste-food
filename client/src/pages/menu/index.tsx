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
import { loadMenuCache, saveMenuCache } from '../../utils/menu-cache';
import {
  applyDineParamsFromRouter,
  clearDineContext,
  loadDineContext,
  type DineContext,
} from '../../utils/dine-context';
import SkeletonLoader from '../../components/SkeletonLoader';
import ListEndTip from '../../components/ListEndTip';
import Icon from '../../components/Icon';
import BottomSheet from '../../components/BottomSheet';
import EmptyState from '../../components/EmptyState';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import './index.scss';

import FlyInAnimation from '../../components/FlyInAnimation';
import MenuItemCard from '../../components/MenuItemCard';
import FoodThumb from '../../components/FoodThumb';
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
  const [listBottomSpacer, setListBottomSpacer] = useState(0);
  const [shopList, setShopList] = useState<Shop[]>([]);
  const [currentShopId, setCurrentShopId] = useState<string>(
    () => cartStore.shopId || DEFAULT_SHOP_ID,
  );
  const [shopPickerVisible, setShopPickerVisible] = useState(false);
  const menuViewHeightRef = useRef(0);
  const menuContentHeightRef = useRef(0);
  const measureCategoryOffsetsRef = useRef<() => void>(() => {});

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

  const applyMenuPayload = useCallback((
    shopData: Shop | null | undefined,
    categoriesData: Category[],
    menuItemsData: MenuItem[],
    popularItems: MenuItem[] = [],
  ) => {
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

    if (shopData) setShop(shopData);
    setCategories(categoryItems);
    setListBottomSpacer(0);
    categoryOffsetsRef.current = [];
  }, []);

  /** 仅有缓存 items 时的临时展示（冷启动先出图，网络回来后整表替换） */
  const applyCachedItems = useCallback((items: MenuItem[]) => {
    if (!items.length) return;
    const prev = categoriesRef.current;
    if (prev.length > 0) {
      const byId = new Map(items.map((item) => [item.id, item]));
      setCategories(
        prev.map((cat) => ({
          ...cat,
          items: cat.items.map((item) => {
            const cached = byId.get(item.id);
            return cached ? { ...item, ...cached } : item;
          }),
        })),
      );
      return;
    }
    setCategories([
      {
        id: 'cached',
        name: '全部菜品',
        iconKey: 'food',
        items,
      },
    ]);
  }, []);

  const loadData = useCallback(async (options?: { forceNetwork?: boolean; shopId?: string }) => {
    const forceNetwork = options?.forceNetwork === true;
    const shopId = options?.shopId || currentShopId || DEFAULT_SHOP_ID;
    setLoadError(false);
    setCanRetry(false);

    // 非强制网络：可用缓存先展示，再后台刷新
    let hasCache = false;
    if (!forceNetwork) {
      const cached = loadMenuCache(shopId);
      if (cached?.items?.length) {
        hasCache = true;
        applyCachedItems(cached.items);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else if (categoriesRef.current.length === 0) {
      setLoading(true);
    }

    try {
      const [shopRes, categoriesRes, menuItemsRes, popularRes, shopsRes] = await Promise.all([
        get<Shop>(`/shops/${shopId}`),
        get<Category[]>('/categories', { shop_id: shopId }),
        get<MenuItem[]>('/menu-items', { shop_id: shopId }),
        get<MenuItem[]>('/menu-items/popular', { shop_id: shopId }),
        get<Shop[]>('/shops'),
      ]);

      const shopData = shopRes.data;
      const categoriesData = categoriesRes.data || [];
      const menuItemsData = menuItemsRes.data || [];
      const popularItems = popularRes.data || [];
      const shopsData = shopsRes.data || [];

      setShopList(shopsData);
      applyMenuPayload(shopData, categoriesData, menuItemsData, popularItems);
      saveMenuCache(shopId, menuItemsData);
      // 同步购物车店铺上下文
      useCartStore.getState().setShopId(shopId);
      setLoadError(false);
      setCanRetry(false);
      setLoading(false);
    } catch (error: any) {
      setLoading(false);
      // 已有缓存/列表时保留展示，仅提示刷新失败
      if (hasCache || categoriesRef.current.length > 0) {
        setLoadError(false);
        console.error('刷新菜单失败:', error);
        Taro.showToast({ title: '菜单刷新失败', icon: 'none' });
        return;
      }
      setCategories([]);
      setLoadError(true);
      setCanRetry(isRetryableError(error));
      console.error('加载菜单失败:', error);
      Taro.showToast({ title: '加载菜单失败', icon: 'none' });
    }
  }, [applyCachedItems, applyMenuPayload, currentShopId]);

  const handleSwitchShop = useCallback((shopId: string) => {
    if (!shopId || shopId === currentShopId) {
      setShopPickerVisible(false);
      return;
    }
    setCurrentShopId(shopId);
    setShopPickerVisible(false);
    setSearchKeyword('');
    setShowSearch(false);
    setActiveCategoryIndex(0);
    void loadData({ forceNetwork: true, shopId });
  }, [currentShopId, loadData]);

  useEffect(() => {
    void loadData({ shopId: currentShopId });
    // 仅首次 / shop 变化由 handleSwitchShop 触发 force 刷新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 下拉刷新：强制走网络
  usePullRefresh(() => loadData({ forceNetwork: true }));

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
        // 点击跳转后重测，避免图片加载导致 offset 漂移
        measureCategoryOffsetsRef.current();
      }, 420);
    }, 16);
  }

  /** 测量各分类区块在内容坐标系中的 offsetTop，用于右侧滚动 → 左侧高亮 */
  const measureCategoryOffsets = useCallback(() => {
    const cats = categoriesRef.current;
    if (!cats.length) return;
    const query = createSelectorQuery();
    query.select('.menu-items').boundingClientRect();
    query.select('.menu-items').scrollOffset();
    cats.forEach((cat) => {
      query.select(`#cat-${cat.id}`).boundingClientRect();
    });
    query.exec((res) => {
      if (!res || !res[0]) return;
      const listRect = res[0] || {};
      const scrollInfo = res[1] || {};
      const listTop = listRect.top || 0;
      const listHeight = listRect.height || 0;
      const scrollTop = scrollInfo.scrollTop || 0;
      const scrollHeight = scrollInfo.scrollHeight || 0;
      menuViewHeightRef.current = listHeight;
      menuContentHeightRef.current = scrollHeight;

      const offsets: number[] = [];
      for (let i = 2; i < res.length; i += 1) {
        const rect = res[i];
        if (!rect) {
          offsets.push(offsets.length ? offsets[offsets.length - 1] : 0);
          continue;
        }
        // 换算为内容顶部坐标系，即使测量时不在顶部也正确
        offsets.push((rect.top || 0) - listTop + scrollTop);
      }
      categoryOffsetsRef.current = offsets;

      // 末项分类内容不足一屏时补 spacer，保证最后一个主菜单能与子菜单标题对齐
      const lastRect = res[res.length - 1];
      if (lastRect && listHeight > 0) {
        const lastHeight = lastRect.height || 0;
        const needed = Math.max(0, Math.ceil(listHeight - lastHeight - 8));
        setListBottomSpacer((prev) => (prev === needed ? prev : needed));
      }
    });
  }, []);

  measureCategoryOffsetsRef.current = measureCategoryOffsets;

  useEffect(() => {
    if (loading || categories.length === 0) return;
    const timer = setTimeout(() => measureCategoryOffsets(), 80);
    const timer2 = setTimeout(() => measureCategoryOffsets(), 360);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [loading, categories, listBottomSpacer, measureCategoryOffsets]);

  const syncActiveCategory = useCallback((nextIndex: number) => {
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

  const handleMenuScroll = useCallback((e: any) => {
    if (scrollLockRef.current) return;
    const detail = e?.detail || {};
    const scrollTop = detail.scrollTop || 0;
    const scrollHeight = detail.scrollHeight || menuContentHeightRef.current || 0;
    const viewHeight = menuViewHeightRef.current || 0;
    const offsets = categoryOffsetsRef.current;
    if (!offsets.length) {
      measureCategoryOffsets();
      return;
    }

    const lastIndex = offsets.length - 1;
    // 滚到底部时强制高亮最后一个主菜单（内容不足一屏也能对应）
    if (viewHeight > 0 && scrollHeight > 0 && scrollTop + viewHeight >= scrollHeight - 48) {
      syncActiveCategory(lastIndex);
      return;
    }

    // 找到最后一个标题已进入视口顶部缓冲区的分类
    let nextIndex = 0;
    const threshold = scrollTop + 48;
    for (let i = 0; i < offsets.length; i += 1) {
      if (offsets[i] <= threshold) nextIndex = i;
      else break;
    }
    syncActiveCategory(nextIndex);
  }, [measureCategoryOffsets, syncActiveCategory]);

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
      const res = await get<MenuItem[]>('/menu-items', { shop_id: currentShopId || DEFAULT_SHOP_ID, search: keyword });
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
        shopId: currentShopId || DEFAULT_SHOP_ID,
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
      'item-bg-hot', 'item-bg-meat', 'item-bg-veg',
      'item-bg-drink', 'item-bg-rice',
    ];
    return bgClasses[categoryIndex % bgClasses.length];
  }

  const getItemBgColorCb = useCallback(getItemBgColor, []);

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
        <View className='menu-header__avatar'><Icon name='shop' size={28} color='#FFFFFF' /></View>
        <View className='menu-header__info'>
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <View
              className='menu-header__title-row'
              onClick={() => shopList.length > 1 && setShopPickerVisible(true)}
            >
              <Text className='menu-header__name'>{shop?.name || '小买卖烧烤'}</Text>
              {shopList.length > 1 ? (
                <Text className='menu-header__switch'>切换</Text>
              ) : null}
              <View
                className={`menu-header__open-badge${shopOpen ? '' : ' menu-header__open-badge--closed'}`}
              >
                <Text>{shopOpen ? '营业中' : '休息中'}</Text>
              </View>
            </View>
            <View className='menu-header__actions'>
              {shopList.length > 1 ? (
                <View
                  className='menu-header__action-btn'
                  onClick={() => setShopPickerVisible(true)}
                  aria-label='切换门店'
                >
                  <Icon name='shop' size={18} color='#FFFFFF' />
                </View>
              ) : null}
              <View
                className={`menu-header__action-btn${showSearch ? ' menu-header__action-btn--active' : ''}`}
                onClick={() => setShowSearch(!showSearch)}
                aria-label={showSearch ? '关闭搜索' : '打开搜索'}
              >
                <Icon name={showSearch ? 'close' : 'search'} size={18} color='#FFFFFF' />
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

      <BottomSheet
        visible={shopPickerVisible}
        onClose={() => setShopPickerVisible(false)}
        title='选择门店'
      >
        <View className='shop-picker'>
          {shopList.map((s) => {
            const active = s.id === currentShopId;
            return (
              <View
                key={s.id}
                className={`shop-picker__item${active ? ' shop-picker__item--active' : ''}`}
                onClick={() => handleSwitchShop(s.id)}
              >
                <View className='shop-picker__main'>
                  <Text className='shop-picker__name'>{s.name}</Text>
                  <Text className='shop-picker__addr'>{s.address || s.description || '门店'}</Text>
                </View>
                <Text className='shop-picker__status'>
                  {(typeof s.isOpenNow === 'boolean' ? s.isOpenNow : s.status === 'open') ? '营业中' : '休息中'}
                </Text>
              </View>
            );
          })}
        </View>
      </BottomSheet>

      {loading ? (
        <SkeletonLoader mode='list' count={5} />
      ) : loadError ? (
        <EmptyState
          icon='warning'
          title='加载失败'
          description={canRetry ? '网络不太稳，点一下再试试' : '菜单暂时加载不出来'}
          actionText={canRetry ? '再试一次' : '重新加载'}
          onAction={() => loadData()}
        />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={searchKeyword.trim() ? 'search' : 'food'}
          title={searchKeyword.trim() ? '没找到相关菜品' : '暂无菜品'}
          description={searchKeyword.trim() ? '换个关键词试试' : '商家还在准备菜单，稍后再来看看'}
          actionText={searchKeyword.trim() ? '清空搜索' : undefined}
          onAction={searchKeyword.trim() ? clearSearch : undefined}
        />
      ) : !categories.some((cat) => cat.items.length > 0) ? (
        <EmptyState
          icon={searchKeyword.trim() ? 'search' : 'food'}
          title={searchKeyword.trim() ? '没找到相关菜品' : '暂无菜品'}
          description={searchKeyword.trim() ? '换个关键词试试' : '商家还在准备菜单，稍后再来看看'}
          actionText={searchKeyword.trim() ? '清空搜索' : undefined}
          onAction={searchKeyword.trim() ? clearSearch : undefined}
        />
      ) : (
        <>
      {dineContext?.tableNo ? (
        <View className='dine-banner' aria-label={`当前桌号 ${dineContext.tableNo}`}>
          <View className='dine-banner__text'>
            <View className='dine-banner__title-row'><Icon name='food' size={16} color='#FF6B35' /><Text className='dine-banner__title'>堂食桌号 {dineContext.tableNo}</Text></View>
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
                <View className='category-sidebar__icon'>
                  <Icon
                    name={getCategoryIcon(cat.iconKey)}
                    size={20}
                    color={index === activeCategoryIndex ? '#FF6B35' : '#999999'}
                  />
                </View>
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
                <View
                  key={cat.id}
                  id={`cat-${cat.id}`}
                  className={`menu-category-section${index === categories.length - 1 ? ' menu-category-section--last' : ''}`}
                >
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
                      />
                    ))
                  )}
                </View>
              ))}
              <ListEndTip
                show={categories.some((cat) => cat.items.length > 0)}
                hasMore={false}
                variant='footer'
                className='menu-items__end-tip'
              />
              {listBottomSpacer > 0 ? (
                <View className='menu-items__bottom-spacer' style={{ height: `${listBottomSpacer}px` }} />
              ) : null}
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
        flush
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
                compact
                icon='order'
                title='购物车是空的'
                description='去挑几道喜欢的菜吧'
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
        flush
      >
        {selectedItem && (
            <View className='spec-popup'>
              <View className='spec-popup__header'>
                <FoodThumb
                  className='spec-popup__image'
                  src={selectedItem.imageUrl}
                  name={selectedItem.name}
                  size='md'
                  round
                />
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
          <Icon name='cart' size={28} color='#FFFFFF' />
        </View>
      )}

      {/* 底部购物车栏：弹层打开时隐藏，避免压住规格弹窗底部按钮 */}
      {cartCount > 0 && !specPopupVisible && (
        <View className='cart-bar' onClick={() => setCartPopupVisible(!cartPopupVisible)}>
          <View className='cart-bar__icon-wrap'>
            <View className='cart-bar__icon'><Icon name='cart' size={22} color='#FFFFFF' /></View>
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
