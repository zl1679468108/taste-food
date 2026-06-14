import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { post } from '../utils/request';
import { ApiResponse } from '../types/api';

/** 登录响应 */
interface LoginResponse {
  token: string;
  userId: string;
  openid: string;
  role: string;
}

/** 用户信息 */
interface User {
  userId: string;
  openid: string;
  role: string;
}

/** Auth Store 状态 */
interface AuthState {
  /** JWT token */
  token: string | null;
  /** 用户信息 */
  user: User | null;
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 是否正在登录 */
  isLoading: boolean;

  /** 登录 */
  login: (code: string) => Promise<void>;
  /** 登出 */
  logout: () => void;
  /** 设置 token */
  setToken: (token: string, user: User) => void;
  /** 从 storage 恢复 token */
  restoreToken: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoggedIn: false,
  isLoading: false,

  login: async (code: string) => {
    set({ isLoading: true });
    try {
      const response: ApiResponse<LoginResponse> = await post(
        '/auth/wechat-login',
        { code },
        { showError: true },
      );

      const { token, userId, openid, role } = response.data;
      const user: User = { userId, openid, role };

      // 保存到 storage
      Taro.setStorageSync('token', token);
      Taro.setStorageSync('user', JSON.stringify(user));

      set({
        token,
        user,
        isLoggedIn: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    Taro.removeStorageSync('token');
    Taro.removeStorageSync('user');

    set({
      token: null,
      user: null,
      isLoggedIn: false,
    });

    Taro.navigateTo({ url: '/pages/auth/login' });
  },

  setToken: (token: string, user: User) => {
    Taro.setStorageSync('token', token);
    Taro.setStorageSync('user', JSON.stringify(user));
    set({ token, user, isLoggedIn: true });
  },

  restoreToken: (): boolean => {
    try {
      const token = Taro.getStorageSync('token');
      const userStr = Taro.getStorageSync('user');

      if (token && userStr) {
        const user = JSON.parse(userStr) as User;
        set({ token, user, isLoggedIn: true });
        return true;
      }
    } catch {
      // 忽略解析错误
    }
    return false;
  },
}));
