import request from '@/utils/request';

export type UserRole = 'admin' | 'merchant' | 'rider' | 'customer';

export interface UserRoleItem {
  role: UserRole | string;
  shopId?: string | null;
  status: string;
}

export interface LoginParams {
  code: string;
  nickName?: string;
}

export interface PasswordLoginParams {
  username: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  password: string;
  nickName?: string;
  phone?: string;
  intentRole?: 'customer' | 'merchant' | 'rider';
}

export interface LoginResult {
  token: string;
  refreshToken?: string;
  userId: string;
  openid?: string;
  role: string;
  shopId?: string;
  nickName?: string;
  username?: string;
  phone?: string;
  roles?: UserRoleItem[];
  avatarUrl?: string;
}

export interface ProfileResult {
  userId: string;
  openid?: string;
  role: string;
  shopId?: string;
  nickName?: string;
  username?: string;
  phone?: string;
  avatarUrl?: string;
  roles?: UserRoleItem[];
}

/** 微信登录（兼容旧入口） */
export const wechatLogin = (params: LoginParams) =>
  request.post('/api/auth/wechat-login', params) as Promise<LoginResult>;

/** @deprecated 请使用 passwordLogin；保留别名避免旧引用报错 */
export const login = wechatLogin;

export const loginAsAdmin = () =>
  wechatLogin({ code: 'admin_code', nickName: '管理员' });

/** 账号密码登录 */
export const passwordLogin = (params: PasswordLoginParams) =>
  request.post('/api/auth/login', params) as Promise<LoginResult>;

/** 注册 */
export const register = (params: RegisterParams) =>
  request.post('/api/auth/register', params) as Promise<LoginResult>;

/** 拉取最新资料（含 roles） */
export const fetchProfile = () =>
  request.get('/api/auth/me') as Promise<ProfileResult>;

/** 切换激活角色 */
export const switchRole = (params: { role: string; shopId?: string }) =>
  request.post('/api/auth/switch-role', params) as Promise<LoginResult>;

/** 开发种子：确保测试商家可用 */
export const seedDemoMerchant = () =>
  request.post('/api/auth/dev/seed-merchant') as Promise<{
    username: string;
    password: string;
    shopId: string;
  }>;

/** 使用 refreshToken 刷新 accessToken */
export const refreshAccessToken = (refreshToken: string) =>
  request.post('/api/auth/refresh', { refreshToken }) as Promise<{
    token: string;
    refreshToken: string;
  }>;

/** 持久化登录态 */
export function persistAuthSession(result: LoginResult) {
  localStorage.setItem('token', result.token);
  if (result.refreshToken) {
    localStorage.setItem('refreshToken', result.refreshToken);
  }
  localStorage.setItem('user', JSON.stringify(result));
}

/** 登录结果 → 布局用 CurrentUser */
export function toCurrentUser(raw: LoginResult | ProfileResult | null | undefined): API.CurrentUser | undefined {
  if (!raw) return undefined;
  const anyRaw = raw as LoginResult & ProfileResult & { id?: string; name?: string };
  return {
    id: anyRaw.id || anyRaw.userId,
    name: anyRaw.name || anyRaw.nickName || anyRaw.username || '用户',
    role: anyRaw.role,
    shopId: anyRaw.shopId || undefined,
    username: anyRaw.username,
    nickName: anyRaw.nickName,
    phone: anyRaw.phone,
    roles: anyRaw.roles || [],
  };
}

/** 运营角色（admin / merchant）默认进看板，其余进轻量中心 */
export function homePathForRole(role?: string): string {
  if (role === 'admin' || role === 'merchant') return '/dashboard';
  return '/account';
}

/**
 * 从 localStorage 读取已登录用户信息。
 * 注意：仅用于快速恢复 UI 状态，真正的 token 有效性由请求拦截器和后端校验。
 */
export const getCurrentUser = async (): Promise<LoginResult | null> => {
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  if (!userStr || !token) return null;
  try {
    return JSON.parse(userStr) as LoginResult;
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    return null;
  }
};
