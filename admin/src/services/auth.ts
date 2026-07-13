import request from '@/utils/request';

export interface LoginParams {
  code: string;
  nickName?: string;
}

export interface LoginResult {
  token: string;
  refreshToken?: string;
  userId: string;
  openid: string;
  role: string;
}

export const login = (params: LoginParams) =>
  request.post('/api/auth/wechat-login', params) as Promise<LoginResult>;

export const loginAsAdmin = () =>
  login({ code: 'admin_code', nickName: '管理员' });

/** 使用 refreshToken 刷新 accessToken，返回新的 token 对 */
export const refreshAccessToken = (refreshToken: string) =>
  request.post('/api/auth/refresh', { refreshToken }) as Promise<{ token: string; refreshToken: string }>;

/**
 * 从 localStorage 读取已登录用户信息。
 * 注意：仅用于快速恢复 UI 状态，真正的 token 有效性由请求拦截器和后端校验。
 * token 过期或无效时，后端返回 401，请求层会清除登录态并跳转登录页。
 */
export const getCurrentUser = async (): Promise<LoginResult | null> => {
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  if (!userStr || !token) return null;
  try {
    return JSON.parse(userStr) as LoginResult;
  } catch {
    // localStorage 数据损坏，清除无效数据
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    return null;
  }
};