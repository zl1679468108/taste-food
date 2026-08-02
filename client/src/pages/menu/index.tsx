import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { flushSync } from 'react-dom';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro, { createSelectorQuery, useDidShow } from '@tarojs/taro';
import { get, post, isRetryableError, isDuplicateSubmitError } from '../../utils/request';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatPriceWithSymbol } from '../../utils/format';
import { getCategoryIcon } from '../../utils/iconMap';
import { Shop } from '../../types/shop';
import { Category, MenuItem, SpecGroup, SpecOption } from '../../types/menu';
import { DEFAULT_SHOP_ID } from '../../env';
import { loadMenuCache, saveMenuCache } from '../../utils/menu-cache';
import {
  clearDineContext,
  loadDineContext,
  parseDineParams,
  saveDineContext,
  type DineContext,
} from '../../utils/dine-context';
import SkeletonLoader from '../../components/SkeletonLoader';
import ListEndTip from '../../components/ListEndTip';
import Icon from '../../components/Icon';
import BottomSheet from '../../components/BottomSheet';
import EmptyState from '../../components/EmptyState';
import FooterBar from '../../components/FooterBar';
import { usePullRefresh } from '../../hooks/usePullRefresh';
import { useSyncTabBar } from '../../hooks/useSyncTabBar';
import { setTabBarSelectedPath, TAB_BAR_PATHS } from '../../utils/tab-bar';
import { useKeyedAsyncAction } from '../../hooks/useAsyncAction';
import './index.scss';

import FlyInAnimation from '../../components/FlyInAnimation';
import MenuItemCard from '../../components/MenuItemCard';
import FoodThumb from '../../components/FoodThumb';
import ShopLogo from '../../components/ShopLogo';
import CartItemRow from '../../components/CartItemRow';
import { getCache, setCache } from '../../utils/cache';

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

function itemHasSpecs(item: MenuItem): boolean {
  return Array.isArray(item.specGroupIds) && item.specGroupIds.length > 0;
}

function getSpecsCacheKey(itemId: string): string {
  return `GET:/menu-items/${itemId}/specs:`;
}

function buildSpecsSelection(specs: SpecGroup[]): {
  specsData: SpecGroupWithSelection[];
  defaultSpecs: Record<string, string>;
  defaultOptionIds: Record<string, string>;
  extraPrice: number;
} {
  const defaultSpecs: Record<string, string> = {};
  const defaultOptionIds: Record<string, string> = {};
  let extraPrice = 0;

  const specsData: SpecGroupWithSelection[] = (specs || []).map((sg) => {
    const selectedOptions = (sg.options || []).map((opt) => ({
      ...opt,
      isSelected: !!opt.isDefault,
    }));
    const defOpt = selectedOptions.find((o) => o.isDefault);
    if (defOpt) {
      defaultSpecs[sg.id] = defOpt.name;
      defaultOptionIds[sg.id] = defOpt.id;
      extraPrice += defOpt.priceAdjust || 0;
    }
    return {
      ...sg,
      selectedOptions,
    };
  });

  return { specsData, defaultSpecs, defaultOptionIds, extraPrice };
}

function readCachedSpecs(itemId: string): SpecGroup[] | null {
  const cached = getCache<SpecGroup[]>(getSpecsCacheKey(itemId));
  return Array.isArray(cached) ? cached : null;
}

function writeCachedSpecs(itemId: string, specs: SpecGroup[]): void {
  setCache(getSpecsCacheKey(itemId), specs || []);
}

/** 菜单列表一次返回的 specs 写入本地缓存，后续加购不再打 /specs */
function seedSpecsCacheFromItems(items: MenuItem[]): void {
  (items || []).forEach((item) => {
    if (Array.isArray((item as any).specs)) {
      writeCachedSpecs(item.id, (item as any).specs as SpecGroup[]);
    }
  });
}


function filterCategoriesByKeyword(
  source: CategoryItemData[],
  keyword: string,
): CategoryItemData[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return source;
  return source
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => {
        const name = (item.name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        return name.includes(normalized) || desc.includes(normalized);
      }),
    }))
    .filter((cat) => cat.items.length > 0);
}


interface MenuItemsPanelProps {
  categories: CategoryItemData[];
  searchKeyword: string;
  listBottomSpacer: number;
  menuScrollIntoView?: string;
  /** 受控恢复位置；与 cartQty 同次更新，抵消微信 scroll-view 子节点 patch 回顶 */
  restoreScrollTop?: number;
  cartQtyByMenuItemId: Record<string, number>;
  onScroll: (e: any) => void;
  onItemClick: (item: MenuItem) => void;
  onAddClick: (item: MenuItem, event?: any) => void;
  onFavorite: (item: MenuItem) => void;
  getItemBgColor: (index: number) => string;
}

/**
 * 独立 memo：弹层开关等无关 props 变化时跳过重渲染。
 * 加购时父层会同时下发 restoreScrollTop + cartQty，保证同一次渲染锁定位置。
 */
const MenuItemsPanel = memo(function MenuItemsPanel({
  categories,
  searchKeyword,
  listBottomSpacer,
  menuScrollIntoView,
  restoreScrollTop,
  cartQtyByMenuItemId,
  onScroll,
  onItemClick,
  onAddClick,
  onFavorite,
  getItemBgColor,
}: MenuItemsPanelProps) {
  return (
    <ScrollView
      id='menu-items-scroll'
      className='menu-items'
      scrollY
      scrollAnchoring
      enhanced
      bounces={false}
      showScrollbar={false}
      enableBackToTop={false}
      scrollWithAnimation={false}
      {...(menuScrollIntoView
        ? { scrollIntoView: menuScrollIntoView, scrollWithAnimation: true }
        : {})}
      {...(typeof restoreScrollTop === 'number' ? { scrollTop: restoreScrollTop } : {})}
      onScroll={onScroll}
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
                <View key={item.id} id={`menu-item-${item.id}`} className='menu-item-anchor'>
                  <MenuItemCard
                    item={item}
                    categoryIndex={index}
                    onItemClick={onItemClick}
                    onAddClick={onAddClick}
                    onFavorite={onFavorite}
                    getItemBgColor={getItemBgColor}
                    cartQuantity={cartQtyByMenuItemId[item.id] || 0}
                  />
                </View>
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
  );
});

export default function MenuPage() {

  const cartStore = useCartStore();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeRole = useAuthStore((s) => s.user?.role);

  const [shop, setShop] = useState<Shop | null>(null);
  const [categories, setCategories] = useState<CategoryItemData[]>([]);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dineContext, setDineContext] = useState<DineContext | null>(null);
  /** 用户手动清除后，忽略仍残留在 router 上的同一桌号，直到扫到新桌号 */
  const ignoredDineTableNoRef = useRef<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [cartPopupVisible, setCartPopupVisible] = useState(false);
  const [specPopupVisible, setSpecPopupVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>({});
  const [selectedSpecOptionIds, setSelectedSpecOptionIds] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  // 全量菜单快照：搜索只在前端过滤，不清空/不覆盖源数据
  const [allCategories, setAllCategories] = useState<CategoryItemData[]>([]);
  const [flyInVisible, setFlyInVisible] = useState(false);
  const [flyInPosition, setFlyInPosition] = useState({ x: 0, y: 0 });
  const [cartBarPulse, setCartBarPulse] = useState(false);
  const [itemSpecs, setItemSpecs] = useState<SpecGroupWithSelection[]>([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [specExtraPrice, setSpecExtraPrice] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const { run: runFavoriteAction } = useKeyedAsyncAction();
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
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
  const scrollLockRefTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryJumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinMenuItemTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRestoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measureCategoryOffsetsRef = useRef<() => void>(() => {});
  const specsRequestSeqRef = useRef(0);
  // 右侧列表仅在点击分类时使用 scrollIntoView；加购和弹层状态不控制滚动位置
  const [menuScrollIntoView, setMenuScrollIntoView] = useState<string | undefined>(undefined);
  const [restoreScrollTop, setRestoreScrollTop] = useState<number | undefined>(undefined);
  const restoreScrollTopRef = useRef<number | undefined>(undefined);
  restoreScrollTopRef.current = restoreScrollTop;
  const menuScrollTopRef = useRef(0);
  // 微信 scroll-top 仅在值变化时生效，用 0/1 抖动保证每次恢复都能写回
  const scrollRestoreNonceRef = useRef(0);

  const redirectNonCustomerRole = useCallback(() => {
    const authState = useAuthStore.getState();
    if (!authState.isLoggedIn) return;
    if (authState.user?.role === 'rider') {
      setTabBarSelectedPath(TAB_BAR_PATHS.rider);
      Taro.switchTab({ url: TAB_BAR_PATHS.rider });
    } else if (authState.user?.role === 'merchant') {
      setTabBarSelectedPath(TAB_BAR_PATHS.admin);
      Taro.switchTab({ url: TAB_BAR_PATHS.admin });
    }
  }, []);

  useSyncTabBar(TAB_BAR_PATHS.menu);

  useDidShow(() => {
    redirectNonCustomerRole();
  });

  useEffect(() => {
    redirectNonCustomerRole();
  }, [isLoggedIn, activeRole, redirectNonCustomerRole]);

  // Refs to avoid stale closures in callbacks
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const allCategoriesRef = useRef(allCategories);
  allCategoriesRef.current = allCategories;
  const searchKeywordRef = useRef(searchKeyword);
  searchKeywordRef.current = searchKeyword;
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
  // tab 页常驻，需在 useDidShow 中重复解析，避免二次扫码/带参进入不刷新
  const refreshDineContext = useCallback(() => {
    try {
      const routerParams = (Taro.getCurrentInstance().router?.params || {}) as Record<
        string,
        string | undefined
      >;
      // 冷启动 / 扫普通链接码：补充 enter/launch 的 query（tableNo 等）
      // 注意：enter.scene 是微信“进入场景数字”(如 1047)，不是桌号业务 scene，绝不能当桌号
      let launchParams: Record<string, string | undefined> = {};
      try {
        const enter =
          (typeof (Taro as any).getEnterOptionsSync === 'function'
            ? (Taro as any).getEnterOptionsSync()
            : null) ||
          (typeof Taro.getLaunchOptionsSync === 'function'
            ? Taro.getLaunchOptionsSync()
            : null) ||
          {};
        const query = (enter.query || {}) as Record<string, string | undefined>;
        launchParams = { ...query };
        // 部分基础库会把小程序码业务 scene 放在 query.scene
        if (query.scene) {
          launchParams.scene = String(query.scene);
        }
      } catch {
        // ignore
      }
      const params = { ...launchParams, ...routerParams };
      const parsed = parseDineParams(params);
      if (parsed?.tableNo) {
        if (ignoredDineTableNoRef.current && parsed.tableNo === ignoredDineTableNoRef.current) {
          setDineContext(loadDineContext());
          return;
        }
        ignoredDineTableNoRef.current = null;
        setDineContext(
          saveDineContext({
            shopId: parsed.shopId,
            tableNo: parsed.tableNo,
            source: 'qr',
          }),
        );
        return;
      }
      setDineContext(loadDineContext());
    } catch {
      setDineContext(loadDineContext());
    }
  }, []);

  useEffect(() => {
    refreshDineContext();
  }, [refreshDineContext]);

  useDidShow(() => {
    refreshDineContext();
  });

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      if (scrollLockRefTimer.current) {
        clearTimeout(scrollLockRefTimer.current);
      }
      if (categoryJumpTimerRef.current) {
        clearTimeout(categoryJumpTimerRef.current);
      }
      if (pinMenuItemTimerRef.current) {
        clearTimeout(pinMenuItemTimerRef.current);
      }
      if (scrollRestoreTimerRef.current) {
        clearTimeout(scrollRestoreTimerRef.current);
      }
    };
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
    setAllCategories(categoryItems);
    // 网络刷新后仍按当前关键词本地过滤，不额外请求 search
    setCategories(filterCategoriesByKeyword(categoryItems, searchKeywordRef.current));
    setListBottomSpacer(0);
    categoryOffsetsRef.current = [];
    // 规格随菜品一次返回：预热缓存，加购无需再请求 /specs
    seedSpecsCacheFromItems(menuItemsData);
    seedSpecsCacheFromItems(popularItems);
  }, []);

  /** 仅有缓存 items 时的临时展示（冷启动先出图，网络回来后整表替换） */
  const applyCachedItems = useCallback((items: MenuItem[]) => {
    if (!items.length) return;
    seedSpecsCacheFromItems(items);
    const prev = allCategoriesRef.current.length > 0
      ? allCategoriesRef.current
      : categoriesRef.current;
    if (prev.length > 0) {
      const byId = new Map(items.map((item) => [item.id, item]));
      const next = prev.map((cat) => ({
        ...cat,
        items: cat.items.map((item) => {
          const cached = byId.get(item.id);
          return cached ? { ...item, ...cached } : item;
        }),
      }));
      setAllCategories(next);
      setCategories(filterCategoriesByKeyword(next, searchKeywordRef.current));
      return;
    }
    const fallback = [
      {
        id: 'cached',
        name: '全部菜品',
        iconKey: 'food',
        items,
      },
    ];
    setAllCategories(fallback);
    setCategories(filterCategoriesByKeyword(fallback, searchKeywordRef.current));
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
      setAllCategories([]);
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
    scrollLockRef.current = true;

    if (categoryJumpTimerRef.current) {
      clearTimeout(categoryJumpTimerRef.current);
      categoryJumpTimerRef.current = null;
    }
    if (scrollLockRefTimer.current) {
      clearTimeout(scrollLockRefTimer.current);
      scrollLockRefTimer.current = null;
    }
    if (scrollRestoreTimerRef.current) {
      clearTimeout(scrollRestoreTimerRef.current);
      scrollRestoreTimerRef.current = null;
    }

    // 微信 scroll-into-view：先卸掉再设置才能重复触发；到位后必须卸掉，避免后续 re-render 再跳
    setRestoreScrollTop(undefined);
    setMenuScrollIntoView(undefined);
    categoryJumpTimerRef.current = setTimeout(() => {
      setMenuScrollIntoView(`cat-${catId}`);
      scrollLockRefTimer.current = setTimeout(() => {
        setMenuScrollIntoView(undefined);
        scrollLockRef.current = false;
        scrollLockRefTimer.current = null;
        categoryJumpTimerRef.current = null;
        measureCategoryOffsetsRef.current();
      }, 360);
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
        setListBottomSpacer((prev) => {
          if (prev === needed) return prev;
          // spacer 变化会改列表高度，同步带上当前位置避免回顶
          const top = menuScrollTopRef.current;
          if (Number.isFinite(top) && top > 0) {
            scrollRestoreNonceRef.current = 1 - scrollRestoreNonceRef.current;
            setRestoreScrollTop(top + scrollRestoreNonceRef.current * 0.01);
          }
          return needed;
        });
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
    const detail = e?.detail || {};
    // H5 / 小程序字段兼容
    const raw = detail.scrollTop;
    const scrollTop = typeof raw === 'number'
      ? raw
      : Number(e?.target?.scrollTop || e?.currentTarget?.scrollTop || 0) || 0;

    // 始终记住原生列表位置，供加购 / 弹层前锁定
    menuScrollTopRef.current = scrollTop;
    if (typeof restoreScrollTopRef.current === 'number') {
      restoreScrollTopRef.current = scrollTop;
    }

    if (scrollLockRef.current) return;

    const scrollHeight = detail.scrollHeight || menuContentHeightRef.current || 0;
    const viewHeight = menuViewHeightRef.current || 0;
    const offsets = categoryOffsetsRef.current;
    if (!offsets.length) {
      // 避免滚动中频繁 measure；仅空 offsets 时补一次
      measureCategoryOffsets();
      return;
    }

    const lastIndex = offsets.length - 1;
    if (viewHeight > 0 && scrollHeight > 0 && scrollTop + viewHeight >= scrollHeight - 48) {
      syncActiveCategory(lastIndex);
      return;
    }

    let nextIndex = 0;
    const threshold = scrollTop + 48;
    for (let i = 0; i < offsets.length; i += 1) {
      if (offsets[i] <= threshold) nextIndex = i;
      else break;
    }
    syncActiveCategory(nextIndex);
  }, [measureCategoryOffsets, syncActiveCategory]);

  /** 读取原生列表当前位置，写入 ref（touch 结束 / 点击前兜底） */
  function snapshotMenuScrollTop() {
    try {
      const query = createSelectorQuery();
      query.select('#menu-items-scroll').scrollOffset((res: any) => {
        const top = res?.scrollTop;
        if (typeof top === 'number' && top >= 0) {
          menuScrollTopRef.current = top;
        }
      }).exec();
    } catch {
      // ignore
    }
  }

  /**
   * 锁定右侧列表滚动位置（必须在会触发列表 patch 的更新之前同步调用）。
   * 微信 scroll-view 子节点更新时常回顶：
   * 1) 先同步下发变化过的 scrollTop（与角标同批）
   * 2) 再在短延迟后重写一次，防止 Taro 拆成多次 setData 时第二次把位置冲掉
   * 恢复后不要清成 undefined。
   */
  function lockMenuScrollPosition() {
    const top = menuScrollTopRef.current;
    if (!Number.isFinite(top) || top <= 0) {
      // ref 可能滞后，异步快照后补锁一次
      snapshotMenuScrollTop();
      if (scrollRestoreTimerRef.current) {
        clearTimeout(scrollRestoreTimerRef.current);
      }
      scrollRestoreTimerRef.current = setTimeout(() => {
        const latest = menuScrollTopRef.current;
        if (Number.isFinite(latest) && latest > 0) {
          scrollRestoreNonceRef.current = 1 - scrollRestoreNonceRef.current;
          const next = latest + scrollRestoreNonceRef.current * 0.01;
          restoreScrollTopRef.current = next;
          try {
            flushSync(() => setRestoreScrollTop(next));
          } catch {
            setRestoreScrollTop(next);
          }
        }
        scrollRestoreTimerRef.current = null;
      }, 32);
      return;
    }

    if (scrollRestoreTimerRef.current) {
      clearTimeout(scrollRestoreTimerRef.current);
      scrollRestoreTimerRef.current = null;
    }

    scrollRestoreNonceRef.current = 1 - scrollRestoreNonceRef.current;
    const next = top + scrollRestoreNonceRef.current * 0.01;
    restoreScrollTopRef.current = next;
    // 关键：zustand 的 useSyncExternalStore 会同步重渲染，
    // 若 scrollTop 还在普通 useState 队列里，会先以「无 scrollTop + 新角标」提交并回顶。
    // flushSync 确保锁定位先提交，再让后续 addItem 进入同树已带 scrollTop 的状态。
    try {
      flushSync(() => {
        setRestoreScrollTop(next);
      });
    } catch {
      setRestoreScrollTop(next);
    }

    // 二次回写：覆盖 Taro 拆 setData / 子节点后置 patch 仍回顶的情况
    const lockedTop = top;
    scrollRestoreTimerRef.current = setTimeout(() => {
      const latest = menuScrollTopRef.current > 0 ? menuScrollTopRef.current : lockedTop;
      scrollRestoreNonceRef.current = 1 - scrollRestoreNonceRef.current;
      const retry = latest + scrollRestoreNonceRef.current * 0.01;
      restoreScrollTopRef.current = retry;
      setRestoreScrollTop(retry);
      scrollRestoreTimerRef.current = null;
    }, 48);
  }

  // 兼容旧调用名
  function preserveMenuScrollPosition() {
    lockMenuScrollPosition();
  }

  /**
   * 仅当检测到列表已经丢位回顶时，才把视角拉回当前菜品。
   * 不能每次都 scroll-into-view：微信常会把目标顶到视口上方，造成二次跳动。
   */
  function pinMenuItemIntoView(itemId: string, expectedTop: number) {
    if (!itemId || expectedTop <= 40) return;
    if (pinMenuItemTimerRef.current) {
      clearTimeout(pinMenuItemTimerRef.current);
      pinMenuItemTimerRef.current = null;
    }
    pinMenuItemTimerRef.current = setTimeout(() => {
      const current = menuScrollTopRef.current;
      // 仍在原位置附近则无需兜底
      if (current >= expectedTop - 80) {
        pinMenuItemTimerRef.current = null;
        return;
      }
      setMenuScrollIntoView(undefined);
      pinMenuItemTimerRef.current = setTimeout(() => {
        setMenuScrollIntoView(`menu-item-${itemId}`);
        // 同步用 scrollTop 再锁一次，避免 intoView 把目标顶到最上方后位置漂移
        lockMenuScrollPosition();
        pinMenuItemTimerRef.current = setTimeout(() => {
          setMenuScrollIntoView(undefined);
          pinMenuItemTimerRef.current = null;
        }, 280);
      }, 16);
    }, 70);
  }

  function triggerCartBarPulse() {
    setCartBarPulse(true);
    setTimeout(() => setCartBarPulse(false), 420);
  }

  function triggerFlyInFromRect(rect: any) {
    if (!rect || Array.isArray(rect)) return;
    const x = (rect.left || 0) + (rect.width || 0) / 2;
    const y = (rect.top || 0) + (rect.height || 0) / 2;
    setFlyInPosition({ x, y });
    setFlyInVisible(true);
    // 飞入接近落点时给购物车栏一个回弹反馈
    setTimeout(() => triggerCartBarPulse(), 480);
    setTimeout(() => setFlyInVisible(false), 650);
  }

  function triggerFlyInFromSelector(selector: string) {
    setTimeout(() => {
      const query = createSelectorQuery();
      query.select(selector).boundingClientRect((rect: any) => {
        triggerFlyInFromRect(rect);
      }).exec();
    }, 40);
  }

  function applySpecSelectionState(
    item: MenuItem,
    specs: SpecGroup[],
    options?: { openPopup?: boolean },
  ) {
    const { specsData, defaultSpecs, defaultOptionIds, extraPrice } = buildSpecsSelection(specs);
    setSelectedItem(item);
    setSelectedSpecs(defaultSpecs);
    setSelectedSpecOptionIds(defaultOptionIds);
    setItemSpecs(specsData);
    setSpecExtraPrice(extraPrice);
    setQuantity(1);
    if (options?.openPopup !== false) {
      setSpecPopupVisible(true);
    }
    setLoadingSpecs(false);
  }

  async function fetchItemSpecs(
    itemId: string,
    options?: { force?: boolean; embedded?: SpecGroup[] | null },
  ): Promise<SpecGroup[]> {
    // 列表/详情已内嵌 specs（含空数组）→ 视为权威结果，不再打 /specs
    if (!options?.force && Array.isArray(options?.embedded)) {
      writeCachedSpecs(itemId, options.embedded);
      return options.embedded;
    }
    if (!options?.force) {
      const cached = readCachedSpecs(itemId);
      if (cached) return cached;
    }
    const specsRes = await get<SpecGroup[]>(`/menu-items/${itemId}/specs`);
    const specs = specsRes.data || [];
    writeCachedSpecs(itemId, specs);
    return specs;
  }

  async function openSpecPopup(item: MenuItem) {
    const requestSeq = ++specsRequestSeqRef.current;
    // 先锁定列表位置，再开弹层（弹层 setState 可能导致 scroll-view 回顶）
    const expectedTop = menuScrollTopRef.current;
    lockMenuScrollPosition();
    pinMenuItemIntoView(item.id, expectedTop);
    // 先开弹层再拉规格：避免点卡片后白等接口
    setSelectedItem(item);
    setQuantity(1);
    setSpecExtraPrice(0);
    setSpecPopupVisible(true);

    // 列表一次返回的 specs 优先
    if (Array.isArray((item as any).specs)) {
      writeCachedSpecs(item.id, (item as any).specs as SpecGroup[]);
    }
    const cached = readCachedSpecs(item.id);
    if (cached) {
      applySpecSelectionState(item, cached);
      // 有缓存时不再强制后台刷新覆盖用户选择，避免弹层内选项被重置
      return;
    }

    // 无缓存：弹层内展示 loading
    setSelectedSpecs({});
    setSelectedSpecOptionIds({});
    setItemSpecs([]);
    setLoadingSpecs(true);
    try {
      const embeddedSpecs = Array.isArray(item.specs) ? item.specs : null;
      const specs = await fetchItemSpecs(item.id, { embedded: embeddedSpecs });
      if (specsRequestSeqRef.current !== requestSeq) return;
      applySpecSelectionState(item, specs);
    } catch (error) {
      if (specsRequestSeqRef.current !== requestSeq) return;
      console.error('加载规格失败:', error);
      applySpecSelectionState(item, []);
      Taro.showToast({ title: '规格加载失败，可直接加购', icon: 'none' });
    }
  }

  /** 点击整张卡片：打开规格/详情 picker */
  function handleItemClick(item: MenuItem) {
    void openSpecPopup(item);
  }

  function addItemToCartDirect(
    item: MenuItem,
    specsData: SpecGroupWithSelection[],
    selectedSpecsMap: Record<string, string>,
    selectedOptionIdsMap: Record<string, string>,
    qty: number,
    flyInSelector?: string,
    options?: { silent?: boolean },
  ) {
    const missingSpecs = specsData
      .filter((sg) => sg.isRequired && !selectedOptionIdsMap[sg.id])
      .map((sg) => sg.name);
    if (missingSpecs.length > 0) {
      Taro.showToast({ title: `请选择${missingSpecs.join('、')}`, icon: 'none' });
      return false;
    }

    const specDesc = Object.values(selectedSpecsMap).filter(Boolean).join('、');
    let extra = 0;
    specsData.forEach((sg) => {
      const raw = selectedOptionIdsMap[sg.id];
      if (!raw) return;
      // 多选时 id 以逗号拼接
      const ids = String(raw).split(',').filter(Boolean);
      ids.forEach((oid) => {
        const selOpt =
          sg.options.find((o) => o.id === oid)
          || sg.selectedOptions?.find((o) => o.id === oid);
        if (selOpt) extra += selOpt.priceAdjust || 0;
      });
    });

    const finalPrice = item.price + extra;
    // 与角标更新同批锁定滚动，避免微信 scroll-view 子节点 patch 回顶
    const expectedTop = menuScrollTopRef.current;
    lockMenuScrollPosition();
    cartStore.addItem({
      menuItemId: item.id,
      name: item.name,
      price: finalPrice,
      quantity: qty,
      specDesc: specDesc || '',
      specOptionIds: Object.values(selectedOptionIdsMap)
        .flatMap((v) => String(v).split(','))
        .filter(Boolean),
      imageUrl: item.imageUrl || '',
    });
    pinMenuItemIntoView(item.id, expectedTop);

    if (flyInSelector) {
      triggerFlyInFromSelector(flyInSelector);
    }
    if (!options?.silent) {
      Taro.showToast({ title: '已加入购物车', icon: 'success', duration: 1000 });
    }
    return true;
  }

  function playQuickAddFeedback(event?: any) {
    const touch = event?.detail || event?.touches?.[0] || event?.changedTouches?.[0];
    if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
      triggerFlyInFromRect({ left: touch.clientX, top: touch.clientY });
      return;
    }
    triggerFlyInFromSelector('.menu-item-card__add-btn');
  }

  function tryDirectAddWithSpecs(item: MenuItem, specs: SpecGroup[], event?: any): boolean {
    const { specsData, defaultSpecs, defaultOptionIds, extraPrice } = buildSpecsSelection(specs);
    const missingRequired = specsData
      .filter((sg) => sg.isRequired && !defaultOptionIds[sg.id])
      .map((sg) => sg.name);
    // 有必选规格但没有默认值：必须打开 picker
    if (missingRequired.length > 0) {
      return false;
    }

    playQuickAddFeedback(event);
    addItemToCartDirect(item, specsData, defaultSpecs, defaultOptionIds, 1);
    // addItemToCartDirect 已 toast；这里补上默认规格加价状态无需进弹层
    setSpecExtraPrice(extraPrice);
    return true;
  }

  /** 点击 +：直接加购到购物车栏，不唤起 picker（缺默认必选规格时才降级） */
  async function handleQuickAdd(item: MenuItem, event?: any) {
    const embedded = Array.isArray(item.specs) ? item.specs : null;
    if (embedded) writeCachedSpecs(item.id, embedded);

    // 1) 已有规格数据（内嵌或缓存）：用默认规格直加
    const cached = embedded || readCachedSpecs(item.id);
    if (cached) {
      if (cached.length === 0) {
        // 明确无规格
        playQuickAddFeedback(event);
        const expectedTop = menuScrollTopRef.current;
        lockMenuScrollPosition();
        cartStore.addItem({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          specDesc: '',
          specOptionIds: [],
          imageUrl: item.imageUrl || '',
        });
        pinMenuItemIntoView(item.id, expectedTop);
        Taro.showToast({ title: '已加入购物车', icon: 'success', duration: 800 });
        return;
      }
      if (tryDirectAddWithSpecs(item, cached, event)) return;
      await openSpecPopup(item);
      Taro.showToast({ title: '请选择规格', icon: 'none' });
      return;
    }

    // 2) 无内嵌/缓存：仅此时请求；兼容旧后端
    try {
      Taro.showLoading({ title: '加购中', mask: true });
      const specs = await fetchItemSpecs(item.id, { embedded });
      Taro.hideLoading();
      if (!specs.length) {
        playQuickAddFeedback(event);
        const expectedTop = menuScrollTopRef.current;
        lockMenuScrollPosition();
        cartStore.addItem({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          specDesc: '',
          specOptionIds: [],
          imageUrl: item.imageUrl || '',
        });
        pinMenuItemIntoView(item.id, expectedTop);
        Taro.showToast({ title: '已加入购物车', icon: 'success', duration: 800 });
        return;
      }
      if (tryDirectAddWithSpecs(item, specs, event)) return;
      await openSpecPopup(item);
      Taro.showToast({ title: '请选择规格', icon: 'none' });
    } catch (error) {
      Taro.hideLoading();
      console.error('快速加购失败:', error);
      await openSpecPopup(item);
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

    const ok = addItemToCartDirect(
      item,
      itemSpecsRef.current,
      selectedSpecsRef.current,
      selectedSpecOptionIdsRef.current,
      quantityRef.current,
      '.spec-popup__add-cart-btn',
    );
    if (ok) {
      setSpecPopupVisible(false);
    }
    setAddingToCart(false);
  }

  function applyLocalSearch(keyword: string) {
    const source = allCategoriesRef.current;
    const next = filterCategoriesByKeyword(source, keyword);
    setCategories(next);
    setActiveCategoryIndex(0);

    setListBottomSpacer(0);
    categoryOffsetsRef.current = [];
  }

  function handleSearch(keyword: string) {
    setSearchKeyword(keyword);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    // 本地过滤 + 300ms 防抖，避免输入过程中频繁重排
    searchTimerRef.current = setTimeout(() => {
      applyLocalSearch(keyword);
    }, 300);
  }

  async function toggleFavorite(item: MenuItem) {
    const authState = useAuthStore.getState();
    if (!authState.isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // toggle 语义下连点会让最终态与服务端不一致：按 menuItemId 维度互斥，
    // 请求期间用带 mask 的 loading 阻断心形二次点击。
    await runFavoriteAction(`fav:${item.id}`, async () => {
      try {
        Taro.showLoading({ title: '处理中', mask: true });
        const res = await post<{ isFavorite: boolean }>('/favorites/toggle', {
          menuItemId: item.id,
          shopId: currentShopId || DEFAULT_SHOP_ID,
        });
        Taro.hideLoading();
        const nextFavorite = res.data?.isFavorite ?? !item.isFavorite;
        Taro.showToast({ title: nextFavorite ? '已收藏' : '已取消收藏', icon: 'success' });

        const patchFavorite = (cats: CategoryItemData[]) =>
          cats.map((cat) => ({
            ...cat,
            items: cat.items.map((i) =>
              i.id === item.id ? { ...i, isFavorite: nextFavorite } : i,
            ),
          }));
        const nextAll = patchFavorite(allCategoriesRef.current);
        preserveMenuScrollPosition();
        setAllCategories(nextAll);
        setCategories(filterCategoriesByKeyword(nextAll, searchKeywordRef.current));
      } catch (e) {
        Taro.hideLoading();
        if (isDuplicateSubmitError(e)) return;
        console.error('收藏操作失败:', e);
        Taro.showToast({ title: '收藏操作失败', icon: 'none' });
      }
    });
  }

  function clearSearch() {
    setSearchKeyword('');
    searchKeywordRef.current = '';
    setShowSearch(false);
    setCategories(allCategoriesRef.current);
    setActiveCategoryIndex(0);

    setListBottomSpacer(0);
    categoryOffsetsRef.current = [];
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
  const cartQtyByMenuItemId = useMemo(() => {
    return cartItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.menuItemId] = (acc[item.menuItemId] || 0) + item.quantity;
      return acc;
    }, {});
  }, [cartItems]);

  // 入口再锁一次：与后续 cart/popup setState 打进同一事件批，同次渲染带上 scrollTop
  const handleItemClickCb = useCallback((item: MenuItem) => {
    lockMenuScrollPosition();
    void openSpecPopup(item);
  }, []);

  const handleQuickAddCb = useCallback((item: MenuItem, event?: any) => {
    lockMenuScrollPosition();
    void handleQuickAdd(item, event);
  }, []);

  const toggleFavoriteCb = useCallback((item: MenuItem) => {
    void toggleFavorite(item);
  }, []);
  // 兼容旧逻辑：显式 isOpenNow 优先，否则回退 status
  const shopOpen =
    typeof shop?.isOpenNow === 'boolean' ? shop.isOpenNow : shop?.status === 'open';

  return (
    <View className='page menu-page'>
      {/* 顶部店铺信息 */}
      <View className='menu-header'>
        <View className='menu-header__avatar'>
          <ShopLogo src={shop?.logoUrl} size={52} alt={shop?.name || '店铺 Logo'} />
        </View>
        <View className='menu-header__info'>
          <View className='menu-header__top'>
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
                onClick={() => {
                  if (showSearch) {
                    clearSearch();
                  } else {
                    setShowSearch(true);
                  }
                }}
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
        avoidTabBar
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
                  <ShopLogo src={s.logoUrl} size={40} alt={s.name || '店铺 Logo'} className='shop-picker__logo' />
                  <View className='shop-picker__text'>
                    <Text className='shop-picker__name'>{s.name}</Text>
                    <Text className='shop-picker__addr'>{s.address || s.description || '门店'}</Text>
                  </View>
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
        <>
          <EmptyState
            icon='warning'
            title='加载失败'
            description={canRetry ? '网络不太稳，点一下再试试' : '菜单暂时加载不出来'}
          />
          <FooterBar
            actionOnly
            avoidTabBar
            actionText={canRetry ? '再试一次' : '重新加载'}
            onAction={() => loadData()}
          />
        </>
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
              ignoredDineTableNoRef.current = dineContext?.tableNo || null;
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

          {/* 右侧菜品列表：memo 隔离，避免打开 picker 时重渲染回顶 */}
          <MenuItemsPanel
            categories={categories}
            searchKeyword={searchKeyword}
            listBottomSpacer={listBottomSpacer}
            menuScrollIntoView={menuScrollIntoView}
            restoreScrollTop={restoreScrollTop}
            cartQtyByMenuItemId={cartQtyByMenuItemId}
            onScroll={handleMenuScroll}
            onItemClick={handleItemClickCb}
            onAddClick={handleQuickAddCb}
            onFavorite={toggleFavoriteCb}
            getItemBgColor={getItemBgColorCb}
          />
        </View>
        </>
      )}

      {/* 购物车弹出层（公共 BottomSheet） */}
      <BottomSheet
        visible={cartPopupVisible}
        onClose={() => setCartPopupVisible(false)}
        title='购物车'
        flush
        avoidTabBar
        headerExtra={
          cartItems.length > 0 ? (
            <View
              className='bottom-sheet-panel__action-text cart-popup__clear'
              onClick={() => cartStore.clearCart()}
            >
              清空
            </View>
          ) : null
        }
      >
        <View className='cart-popup cart-popup--embedded'>
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
        onClose={() => {
          setSpecPopupVisible(false);
        }}
        title={selectedItem?.name || '选择规格'}
        flush
        avoidTabBar
      >
        {selectedItem && (
            <View className='spec-popup'>
              <View className='spec-popup__scroll-body'>
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
                                <Text className='spec-option__price'>+{formatPriceWithSymbol(opt.priceAdjust)}</Text>
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
              </View>{/* spec-popup__scroll-body */}

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

      {/* 飞入动画：从 + / 加购按钮飞向底部购物车 */}
      <FlyInAnimation visible={flyInVisible} start={flyInPosition} />

      {/* 底部购物车栏：始终挂载，空车/弹层时仅隐藏，避免挂载引起列表重排回顶 */}
      <View
        className={`cart-bar${cartCount > 0 && !specPopupVisible ? '' : ' cart-bar--hidden'}${cartBarPulse ? ' cart-bar--pulse' : ''}`}
        onClick={() => {
          if (cartCount <= 0 || specPopupVisible) return;
          setCartPopupVisible(!cartPopupVisible);
        }}
      >
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
    </View>
  );
}
