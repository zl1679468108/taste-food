/** 购物车中的单个商品项 */
export interface CartItem {
  /** 菜品 ID */
  menuItemId: string;
  /** 菜品名称 */
  name: string;
  /** 单价（分） */
  price: number;
  /** 数量 */
  quantity: number;
  /** 所选规格描述 */
  specDesc?: string;
  /** 菜品图片 */
  imageUrl?: string;
  /** 唯一标识（用于区分同菜品不同规格） */
  key: string;
}

/** 购物车状态（Zustand Store） */
export interface CartState {
  /** 购物车商品列表 */
  items: CartItem[];
  /** 所属店铺 ID */
  shopId: string | null;
  /** 添加商品 */
  addItem: (item: Omit<CartItem, 'key'>) => void;
  /** 减少商品数量 */
  decreaseItem: (key: string) => void;
  /** 移除商品 */
  removeItem: (key: string) => void;
  /** 清空购物车 */
  clearCart: () => void;
  /** 获取商品总数 */
  getTotalCount: () => number;
  /** 获取总价（分） */
  getTotalPrice: () => number;
  /** 设置店铺 */
  setShopId: (shopId: string) => void;
}
