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
  /** 所选规格描述（用于展示） */
  specDesc: string;
  /** 所选规格选项 ID 列表（已排序，用于生成稳定的唯一 key） */
  specOptionIds?: string[];
  /** 菜品图片 */
  imageUrl: string;
  /** 唯一标识（用于区分同菜品不同规格） */
  key: string;
}

/** 购物车状态（Zustand Store） */
export interface CartState {
  /** 购物车商品列表 */
  items: CartItem[];
  /** 所属店铺 ID */
  shopId: string | null;
  /** 订单备注 */
  remarks: string;
  /** 添加商品 */
  addItem: (item: Omit<CartItem, 'key'>) => void;
  /** 移除商品 */
  removeItem: (key: string) => void;
  /** 批量移除商品 */
  removeItems: (keys: string[]) => void;
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
