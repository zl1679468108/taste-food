/**
 * 三端共享实体类型定义
 * 所有字段与 server 端数据库 schema 保持一致（snake_case 在 API 层转换）
 */
import { OrderStatus, DeliveryType, MenuItemStatus, ShopStatus, UserRole, PromotionType, PromotionStatus } from '../constants';

/** 统一 API 响应格式 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

/** 分页数据 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 分页查询参数 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/** 菜品分类 */
export interface Category {
  id: string;
  shopId: string;
  name: string;
  sortOrder: number;
  iconKey?: string;
  createdAt: string;
  updatedAt: string;
}

/** 规格选项 */
export interface SpecOption {
  id: string;
  specGroupId: string;
  name: string;
  priceAdjust: number; // 单位：分
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 规格组 */
export interface SpecGroup {
  id: string;
  shopId: string;
  name: string;
  isRequired: boolean;
  maxSelect: number;
  options: SpecOption[];
  createdAt: string;
  updatedAt: string;
}

/** 菜品 */
export interface MenuItem {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  price: number; // 单位：分
  imageUrl?: string;
  description?: string;
  status: MenuItemStatus;
  salesCount: number;
  specGroupIds?: string[];
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 带有规格的菜品（购物车/详情使用） */
export interface MenuItemWithSpecs extends MenuItem {
  specs?: SpecGroup[];
}

/** 选中的规格 */
export interface SelectedSpec {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceAdjust: number;
}

/** 订单项 */
export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number; // 单位：分
  specDesc?: string;
  imageUrl?: string;
  specOptionIds?: string[];
}

/** 配送信息 */
export interface DeliveryInfo {
  id: string;
  orderId: string;
  type: DeliveryType;
  address?: string;
  tableNo?: string;
  contactName?: string;
  contactPhone?: string;
}

/** 配送轨迹点 */
export interface DeliveryTrackPoint {
  id: string;
  orderId: string;
  shopId: string;
  riderId?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  accuracy?: number;
  source: string;
  recordedAt: string;
  createdAt: string;
}

/** 订单 */
export interface Order {
  id: string;
  /** 业务订单号（新单必有；旧单可能由后端兼容生成展示值） */
  orderNo?: string;
  shopId: string;
  userId: string;
  riderId?: string;
  status: OrderStatus;
  total: number; // 单位：分
  deliveryFee: number; // 单位：分
  deliveryType: DeliveryType;
  address?: string;
  /** 下单时店铺坐标快照（GCJ-02，腾讯地图） */
  shopLatitude?: number;
  shopLongitude?: number;
  /** 下单时配送地址坐标快照（GCJ-02，腾讯地图） */
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  tableNo?: string;
  remark?: string;
  contactName?: string;
  contactPhone?: string;
  invoiceNeeded?: boolean;
  invoiceTitle?: string;
  invoiceTaxNo?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  estimatedCompletion?: string;
}

/** 订单状态历史 */
export interface OrderStatusHistoryItem {
  status: OrderStatus;
  time: string;
}

/** 营业日 key */
export type BusinessDayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface BusinessTimeRange {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export type BusinessHours = Record<BusinessDayKey, BusinessTimeRange[]>;

/** 店铺 */
export interface Shop {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  status: ShopStatus;
  deliveryRange: number; // 单位：米
  deliveryFee: number; // 单位：分
  minOrderAmount: number; // 单位：分
  businessHours?: BusinessHours;
  /** 当前是否可下单（综合开关店 + 营业时段） */
  isOpenNow?: boolean;
  /** 非营业时的下次营业提示 */
  nextOpenHint?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 用户 */
export interface User {
  id: string;
  openid: string;
  role: UserRole;
  shopId?: string; // admin 必填
  nickName?: string;
  avatarUrl?: string;
  createdAt: string;
}

/** 促销 */
export interface Promotion {
  id: string;
  shopId: string;
  type: PromotionType;
  name: string;
  description?: string;
  rule: Record<string, number>; // 金额字段单位：分
  startDate?: string;
  endDate?: string;
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
}

/** 订单统计 */
export interface OrderStats {
  totalOrders: number;
  totalRevenue: number; // 单位：分
  pendingCount: number;
  preparingCount: number;
  completedCount: number;
}
