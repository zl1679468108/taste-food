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
  /** 规格明细（菜单列表一次返回；加购可直接用，无需再请求 /specs） */
  specs?: SpecGroup[];
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

/** 订单状态历史 */
export interface OrderStatusHistoryItem {
  status: OrderStatus;
  time: string;
  fromStatus?: OrderStatus;
}

/** 送达凭证照片 */
export interface DeliveryProofPhoto {
  url: string;
  path?: string;
  uploadedAt?: string;
}

/** 外卖送达凭证（地理围栏 + 现场照片） */
export interface DeliveryProof {
  photos: DeliveryProofPhoto[];
  deliveredAt: string;
  confirmLatitude?: number;
  confirmLongitude?: number;
  confirmAccuracy?: number;
  confirmDistanceM?: number;
  confirmRadiusM?: number;
  riderId?: string;
  courierName?: string;
  courierPhone?: string;
  confirmSource?: string;
  forceReason?: string;
}

/** 订单 */
export interface Order {
  id: string;
  /** 业务订单号（新单必有；旧单可能由后端兼容生成展示值） */
  orderNo?: string;
  shopId: string;
  userId: string;
  riderId?: string;
  /** 当前骑手手上配送中的外送单数量（含当前单） */
  riderDeliveryCount?: number;
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
  cancelReason?: string;
  rejectReason?: string;
  contactName?: string;
  contactPhone?: string;
  invoiceNeeded?: boolean;
  invoiceTitle?: string;
  invoiceTaxNo?: string;
  items: OrderItem[];
  /** 订单各状态完成时间，按 time 升序 */
  statusHistory?: OrderStatusHistoryItem[];
  createdAt: string;
  updatedAt: string;
  /** 预计完成/出餐时间 ISO */
  estimatedCompletion?: string;
  /** 顾客申请取消时间 */
  cancelRequestedAt?: string;
  /** 顾客申请取消原因 */
  cancelRequestReason?: string;
  /** 最近催单时间 */
  lastUrgedAt?: string;
  /** 催单次数 */
  urgeCount?: number;
  /** 店铺电话（详情接口可附带，便于一键拨打） */
  shopPhone?: string;
  /** 店铺名称（列表/详情可附带） */
  shopName?: string;
  /** 店铺地址（详情接口可附带，自取订单用于展示/导航） */
  shopAddress?: string;
  /** 骑手电话（配送中可附带） */
  riderPhone?: string;
  /** 骑手昵称 */
  riderName?: string;
  /** 店铺送达围栏（米） */
  deliveryConfirmRadiusM?: number;
  /** 外卖送达凭证 */
  deliveryProof?: DeliveryProof;
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


/** 订单端可执行操作 */
export interface OrderStatusAction {
  label: string;
  status: string;
  type: 'primary' | 'danger';
  cancel?: boolean;
  /** 外卖配送中强制完成（需原因，走 force-complete） */
  forceComplete?: boolean;
  /** 接单时可附带预计出餐分钟 */
  acceptWithEta?: boolean;
}

/**
 * 根据订单状态与配送方式返回可用操作列表（与 admin 端状态流转保持一致）
 * 用于统一维护前后端订单状态操作映射
 */
export function getOrderStatusActions(
  status: string,
  deliveryType: string,
): OrderStatusAction[] {
  switch (status) {
    case OrderStatus.PENDING_PAYMENT:
      return [
        {
          label: '取消订单',
          status: OrderStatus.CANCELLED,
          type: 'danger',
          cancel: true,
        },
      ];
    case OrderStatus.PAID:
      return [
        {
          label: '接单',
          status: OrderStatus.ACCEPTED,
          type: 'primary',
          acceptWithEta: true,
        },
        {
          label: '拒单',
          status: OrderStatus.REJECTED,
          type: 'danger',
        },
        {
          label: '取消订单',
          status: OrderStatus.CANCELLED,
          type: 'danger',
          cancel: true,
        },
      ];
    case OrderStatus.ACCEPTED:
      return [
        {
          label: '开始制作',
          status: OrderStatus.PREPARING,
          type: 'primary',
        },
        {
          label: '取消退款',
          status: OrderStatus.CANCELLED,
          type: 'danger',
          cancel: true,
        },
      ];
    case OrderStatus.PREPARING:
      return deliveryType === DeliveryType.DELIVERY
        ? [
            {
              label: '出餐完成（待骑手）',
              status: OrderStatus.READY_FOR_DELIVERY,
              type: 'primary',
            },
            {
              label: '取消退款',
              status: OrderStatus.CANCELLED,
              type: 'danger',
              cancel: true,
            },
          ]
        : [
            {
              label:
                deliveryType === DeliveryType.DINE_IN
                  ? '待取餐（制作完成）'
                  : '待自取（制作完成）',
              status: OrderStatus.READY_FOR_PICKUP,
              type: 'primary',
            },
            {
              label: '取消退款',
              status: OrderStatus.CANCELLED,
              type: 'danger',
              cancel: true,
            },
          ];
    case OrderStatus.READY_FOR_DELIVERY:
      return [
        {
          label: '取消退款',
          status: OrderStatus.CANCELLED,
          type: 'danger',
          cancel: true,
        },
      ];
    case OrderStatus.READY_FOR_PICKUP:
      return [
        {
          label: '确认取餐',
          status: OrderStatus.COMPLETED,
          type: 'primary',
        },
        {
          label: '取消退款',
          status: OrderStatus.CANCELLED,
          type: 'danger',
          cancel: true,
        },
      ];
    case OrderStatus.DELIVERING:
      return [
        {
          label: '强制完成',
          status: OrderStatus.COMPLETED,
          type: 'primary',
          forceComplete: true,
        },
      ];
    default:
      return [];
  }
}
