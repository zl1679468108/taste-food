import request from '@/utils/request';

export interface LoginParams {
  code: string;
  nickName?: string;
}

export interface LoginResult {
  token: string;
  userId: string;
  openid: string;
  role: string;
}

export const login = (params: LoginParams) =>
  request.post('/api/auth/wechat-login', params) as Promise<LoginResult>;

export const loginAsAdmin = () =>
  login({ code: 'admin_code', nickName: '管理员' });

export const getCurrentUser = async () => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    return JSON.parse(userStr);
  }
  return null;
};