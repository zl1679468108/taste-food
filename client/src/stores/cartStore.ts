import { create } from 'zustand';
import { CartItem } from '../types/cart';

/**
 * 生成购物车商品唯一标识
 */
function generateItemKey(menuItemId: string, specDesc?: string): string {
  return `${menuItemId}_${specDesc || 'default'}`;
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
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  shopId: null,
  remarks: '',

  addItem: (item) => {
    const { items } = get();
    const key = generateItemKey(item.menuItemId, item.specDesc);
    const existingIndex = items.findIndex((i) => i.key === key);

    if (existingIndex >= 0) {
      // 已存在则增加数量
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + item.quantity,
      };
      set({ items: updated });
    } else {
      // 不存在则新增
      const newItem: CartItem = {
        ...item,
        key,
        specDesc: item.specDesc || '',
        imageUrl: item.imageUrl || '',
      };
      set({ items: [...items, newItem] });
    }
  },

  removeItem: (key) => {
    const { items } = get();
    set({ items: items.filter((i) => i.key !== key) });
  },

  updateQuantity: (key, delta) => {
    const { items } = get();
    const updated = items
      .map((item) => {
        if (item.key !== key) return item;
        const newQty = item.quantity + delta;
        // 数量 <= 0 时移除
        return newQty <= 0 ? null : { ...item, quantity: newQty };
      })
      .filter(Boolean) as CartItem[];
    set({ items: updated });
  },

  setQuantity: (key, quantity) => {
    if (quantity <= 0) {
      get().removeItem(key);
      return;
    }
    const { items } = get();
    const updated = items.map((item) =>
      item.key === key ? { ...item, quantity } : item,
    );
    set({ items: updated });
  },

  clearCart: () => {
    set({ items: [], remarks: '' });
  },

  setRemarks: (text) => {
    set({ remarks: text });
  },

  setShopId: (shopId) => {
    const currentShopId = get().shopId;
    // 切换店铺时清空购物车
    if (currentShopId && currentShopId !== shopId) {
      set({ items: [], shopId, remarks: '' });
    } else {
      set({ shopId });
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
}));
