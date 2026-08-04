import request from '@/utils/request';

export interface User {
  id: string;
  openid: string;
  role: string;
  nickName: string;
  avatarUrl: string;
  shopId?: string;
  createdAt: string;
  updatedAt?: string;
  registerDate?: string;
  /** 最后登录时间 ISO；从未登录为空 */
  lastLoginAt?: string;
  /** 手机号（T312.4 / tf_users.phone） */
  phone?: string;
  /** 账号状态（active/disabled/banned）；§3.24 */
  status?: string;
}

export interface CreateUserPayload {
  nickName: string;
  role: 'customer' | 'admin' | 'merchant' | 'rider';
  shopId?: string;
  openid?: string;
  avatarUrl?: string;
}

export interface UpdateUserPayload {
  nickName?: string;
  avatarUrl?: string;
  role?: 'customer' | 'admin' | 'merchant' | 'rider';
  shopId?: string | null;
}

/** 用户角色条目（来自 tf_user_roles；§3.24） */
export interface UserRoleEntry {
  role: string;
  shopId?: string;
  /** active=当前生效；inactive=历史；pending=申请中 */
  status: string;
}

/** 用户画像业务聚合（§3.24 / T312.2） */
export interface UserProfileStats {
  orderCount?: number;
  totalSpent?: number;
  lastOrderAt?: string;
  favoriteCount?: number;
  shopRecent30dOrders?: number;
  shopTotalOrders?: number;
  shopStatus?: string;
  completedOrders?: number;
  deliveringOrders?: number;
  avgRating?: number;
  platformOrdersToday?: number;
}

/** 用户详情 + 画像（抽屉统一数据结构） */
export interface UserProfile extends User {
  roles: UserRoleEntry[];
  stats: UserProfileStats;
  recentAudits: Array<{
    id: string;
    method: string;
    path: string;
    action: string;
    summary: string;
    statusCode?: number;
    createdAt: string;
  }>;
}

export interface GetUsersParams {
  page: number;
  pageSize: number;
  role?: string;
  keyword?: string;
  /** T312.5 状态筛选 */
  status?: string;
  /** T312.5 注册时间过滤（最近 N 天） */
  registeredWithinDays?: number;
}

export const getUsers = (params: GetUsersParams) =>
  request.get('/api/users', { params }) as Promise<{ items: User[]; total: number }>;

export const getUser = (id: string) =>
  request.get(`/api/users/${id}`) as Promise<User>;

export const getUserProfile = (id: string) =>
  request.get(`/api/users/${id}/profile`) as Promise<UserProfile>;

export const getMe = () =>
  request.get('/api/users/me') as Promise<User>;

export const createUser = (data: CreateUserPayload) =>
  request.post('/api/users', data) as Promise<User>;

export const updateUser = (id: string, data: UpdateUserPayload) =>
  request.patch(`/api/users/${id}`, data) as Promise<User>;

export const updateMe = (data: Pick<UpdateUserPayload, 'nickName' | 'avatarUrl'>) =>
  request.patch('/api/users/me', data) as Promise<User>;
