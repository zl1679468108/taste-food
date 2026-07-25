import { create } from 'zustand';
import * as TaroImport from '@tarojs/taro';
import { CartItem } from '../types/cart';

const Taro = (TaroImport as typeof TaroImport & { default?: typeof TaroImport }).default || TaroImport;

const CART_STORAGE_KEY = 'taste_food_cart';
const CART_PERSIST_DEBOUNCE_MS = 1000;
const isTestEnv = process.env.NODE_ENV === 'test';

/**
 * 生成购物车商品唯一标识
 *
 * 优先使用 specOptionIds（排序后拼接）作为规格区分键：
 * - 比 specDesc 更稳定，避免"加辣、加葱"和"加葱、加辣"产生相同 key
 * - 不受规格描述文本顺序影响
 *
 * 回退到 specDesc 以兼容旧数据
 */
function generateItemKey(menuItemId: string, specDesc?: string, specOptionIds?: string[]): string {
  if (specOptionIds && specOptionIds.length > 0) {
    // 排序后拼接，确保不同选择顺序产生相同 key
    const sortedIds = [...specOptionIds].sort().join(',');
    return `${menuItemId}_${sortedIds}`;
  }
  return `${menuItemId}_${specDesc || 'default'}`;
}

// 防抖缓存
let persistTimer: NodeJS.Timeout | null = null;
let persistState: { items: CartItem[]; shopId: string | null; remarks: string } | null = null;

/**
 * 持久化购物车到 Storage（防抖）
 */
function persistCart(state: { items: CartItem[]; shopId: string | null; remarks: string }) {
  // 保存当前状态用于防抖
  persistState = state;
  
  // 清除之前的定时器
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  // 设置新的定时器，1秒后执行持久化
  persistTimer = setTimeout(() => {
    try {
      if (persistState) {
        Taro.setStorageSync(CART_STORAGE_KEY, persistState);
        if (!isTestEnv) {
          console.log('[Cart] Shopping cart persisted successfully');
        }
      }
    } catch (error) {
      console.error('[Cart] Failed to persist shopping cart:', error);
    }
    persistTimer = null;
    persistState = null;
  }, CART_PERSIST_DEBOUNCE_MS); // 1秒防抖延迟
}

/**
 * 立即持久化购物车（用于关键操作如清空购物车）
 */
function persistCartImmediate(state: { items: CartItem[]; shopId: string | null; remarks: string }) {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistState = state;
  try {
    Taro.setStorageSync(CART_STORAGE_KEY, state);
    if (!isTestEnv) {
      console.log('[Cart] Shopping cart persisted immediately');
    }
  } catch (error) {
    console.error('[Cart] Failed to persist shopping cart:', error);
  }
  persistState = null;
}

/**
 * 从 Storage 恢复购物车
 */
function loadCart(): { items: CartItem[]; shopId: string | null; remarks: string } {
  try {
    const data = Taro.getStorageSync(CART_STORAGE_KEY);
    if (data && Array.isArray(data.items)) {
      if (!isTestEnv) {
        console.log('[Cart] Shopping cart loaded from storage:', data.items.length, 'items');
      }
      return { items: data.items, shopId: data.shopId || null, remarks: data.remarks || '' };
    }
  } catch (error) {
    console.error('[Cart] Failed to load shopping cart:', error);
  }
  return { items: [], shopId: null, remarks: '' };
}

/** 购物车 Store 状态 */
interface CartState {
  /** 购物车商品列表 */
  items: CartItem[];
  /** 所属店铺 ID */
  shopId: string | null;
  /** 订单备注 */
  remarks: string;

  /** 添加商品（如果已存在同规格则增加数量） */
  addItem: (item: Omit<CartItem, 'key'>) => void;
  /** 移除商品 */
  removeItem: (key: string) => void;
  /** 更新商品数量（delta = +1 或 -1） */
  updateQuantity: (key: string, delta: number) => void;
  /** 直接设置商品数量 */
  setQuantity: (key: string, quantity: number) => void;
  /** 清空购物车 */
  clearCart: () => void;
  /** 设置备注 */
  setRemarks: (text: string) => void;
  /** 设置店铺 */
  setShopId: (shopId: string) => void;
  /** 计算总价（分） */
  getTotalPrice: () => number;
  /** 计算总件数 */
  getTotalCount: () => number;
  /** 手动保存购物车到存储 */
  saveCart: () => void;
}

// 从 Storage 恢复初始状态
const savedCart = loadCart();

export const useCartStore = create<CartState>((set, get) => ({
  items: savedCart.items,
  shopId: savedCart.shopId,
  remarks: savedCart.remarks,

  addItem: (item) => {
    const { items } = get();
    const key = generateItemKey(item.menuItemId, item.specDesc, item.specOptionIds);
    const existingIndex = items.findIndex((i) => i.key === key);

    let newItems: CartItem[];
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + item.quantity,
      };
      newItems = updated;
    } else {
      const newItem: CartItem = {
        ...item,
        key,
        specDesc: item.specDesc || '',
        imageUrl: item.imageUrl || '',
      };
      newItems = [...items, newItem];
    }
    set({ items: newItems });
    persistCart({ items: newItems, shopId: get().shopId, remarks: get().remarks });
  },

  removeItem: (key) => {
    const { items, shopId, remarks } = get();
    const newItems = items.filter((i) => i.key !== key);
    set({ items: newItems });
    persistCart({ items: newItems, shopId, remarks });
  },

  updateQuantity: (key, delta) => {
    const { items, shopId, remarks } = get();
    const newItems = items
      .map((item) => {
        if (item.key !== key) return item;
        const newQty = item.quantity + delta;
        return newQty <= 0 ? null : { ...item, quantity: newQty };
      })
      .filter(Boolean) as CartItem[];
    set({ items: newItems });
    persistCart({ items: newItems, shopId, remarks });
  },

  setQuantity: (key, quantity) => {
    if (quantity <= 0) {
      get().removeItem(key);
      return;
    }
    const { items, shopId, remarks } = get();
    const newItems = items.map((item) =>
      item.key === key ? { ...item, quantity } : item,
    );
    set({ items: newItems });
    persistCart({ items: newItems, shopId, remarks });
  },

  clearCart: () => {
    set({ items: [], remarks: '' });
    // 清空购物车是关键操作，立即持久化
    persistCartImmediate({ items: [], shopId: get().shopId, remarks: '' });
  },

  setRemarks: (text) => {
    set({ remarks: text });
    persistCart({ items: get().items, shopId: get().shopId, remarks: text });
  },

  setShopId: (shopId) => {
    const currentShopId = get().shopId;
    if (currentShopId && currentShopId !== shopId) {
      // 切换店铺时清空购物车（不同店铺的菜品不互通）
      // 异步提示用户，不阻塞 store 更新
      const hadItems = get().items.length > 0;
      set({ items: [], shopId, remarks: '' });
      persistCartImmediate({ items: [], shopId, remarks: '' });
      if (hadItems) {
        // 延迟提示，避免在 store action 中直接调用 Taro API 导致渲染冲突
        setTimeout(() => {
          try {
            Taro.showToast({ title: '已切换店铺，购物车已清空', icon: 'none' });
          } catch {
            // ignore
          }
        }, 0);
      }
    } else {
      set({ shopId });
      persistCart({ items: get().items, shopId, remarks: get().remarks });
    }
  },

  getTotalPrice: (): number => {
    return get().items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  },

  getTotalCount: (): number => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  saveCart: () => {
    const state = get();
    persistCartImmediate({ items: state.items, shopId: state.shopId, remarks: state.remarks });
  },
}));

// 页面卸载时保存购物车
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useCartStore.getState().saveCart();
  });
}
