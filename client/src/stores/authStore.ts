import { create } from 'zustand';
import * as TaroImport from '@tarojs/taro';
import { post, get as getRequest } from '../utils/request';
import { ApiResponse } from '../types/api';

const Taro = (TaroImport as typeof TaroImport & { default?: typeof TaroImport }).default || TaroImport;

/** 登录响应 */
interface LoginResponse {
  token: string;
  refreshToken: string;
  userId: string;
  openid: string;
  role: string;
}

/** 用户信息 */
interface User {
  userId: string;
  openid: string;
  role: string;
  nickName?: string;
}

/** Auth Store 状态 */
interface AuthState {
  /** JWT token */
  token: string | null;
  /** Refresh token */
  refreshToken: string | null;
  /** 用户信息 */
  user: User | null;
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 是否正在登录 */
  isLoading: boolean;
  /** token 刷新定时器 */
  refreshTimer: NodeJS.Timeout | null;

  /** 登录 */
  login: (code: string) => Promise<void>;
  /** 登出 */
  logout: () => void;
  /** 设置 token */
  setToken: (token: string, refreshToken: string, user: User) => void;
  /** 从 storage 恢复 token */
  restoreToken: () => boolean;
  /** 刷新 session/token */
  refreshSession: () => Promise<void>;
  /** 启动 token 自动刷新 */
  startAutoRefresh: () => void;
  /** 停止 token 自动刷新 */
  stopAutoRefresh: () => void;
  /** 切换角色（用对应 code 重新登录，保持同一用户体系） */
  switchRole: (targetRole: 'customer' | 'admin' | 'rider') => Promise<void>;
  /** 获取当前角色显示名称 */
  getRoleLabel: (role: string) => string;
}

// Access Token 有效期：15 分钟
const ACCESS_TOKEN_EXPIRES_MS = 15 * 60 * 1000;
// 提前 1 分钟刷新
const REFRESH_BUFFER_MS = 60 * 1000;

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  isLoggedIn: false,
  isLoading: false,
  refreshTimer: null,

  login: async (code: string) => {
    set({ isLoading: true });
    try {
      const response: ApiResponse<LoginResponse> = await post(
        '/auth/wechat-login',
        { code },
        { showError: true },
      );

      const { token, refreshToken, userId, openid, role } = response.data;
      const user: User = { userId, openid, role };

      // 保存到 storage
      Taro.setStorageSync('token', token);
      Taro.setStorageSync('refreshToken', refreshToken);
      Taro.setStorageSync('user', JSON.stringify(user));

      set({
        token,
        refreshToken,
        user,
        isLoggedIn: true,
        isLoading: false,
      });

      // 启动自动刷新
      get().startAutoRefresh();
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    // 停止自动刷新
    get().stopAutoRefresh();

    Taro.removeStorageSync('token');
    Taro.removeStorageSync('refreshToken');
    Taro.removeStorageSync('user');

    set({
      token: null,
      refreshToken: null,
      user: null,
      isLoggedIn: false,
    });

    Taro.reLaunch({ url: '/pages/auth/login' });
  },

  setToken: (token: string, refreshToken: string, user: User) => {
    Taro.setStorageSync('token', token);
    Taro.setStorageSync('refreshToken', refreshToken);
    Taro.setStorageSync('user', JSON.stringify(user));
    set({ token, refreshToken, user, isLoggedIn: true });
  },

  restoreToken: (): boolean => {
    try {
      const token = Taro.getStorageSync('token');
      const refreshToken = Taro.getStorageSync('refreshToken');
      const userStr = Taro.getStorageSync('user');

      if (token && refreshToken && userStr) {
        const user = JSON.parse(userStr) as User;
        set({ token, refreshToken, user, isLoggedIn: true });
        
        // 启动自动刷新
        setTimeout(() => get().startAutoRefresh(), 1000);
        return true;
      }
    } catch {
      // 忽略解析错误
    }
    return false;
  },

  refreshSession: async () => {
    const { refreshToken, isLoggedIn } = get();
    if (!isLoggedIn || !refreshToken) return;

    try {
      const res: ApiResponse<{ token: string; refreshToken: string }> = await post(
        '/auth/refresh',
        { refreshToken },
        { showError: false },
      );
      
      if (res.code === 0 && res.data.token) {
        const { token: newToken, refreshToken: newRefreshToken } = res.data;
        Taro.setStorageSync('token', newToken);
        Taro.setStorageSync('refreshToken', newRefreshToken);
        set({ token: newToken, refreshToken: newRefreshToken });
        
        console.log('[Auth] Token 刷新成功');
      }
    } catch (e) {
      console.warn('[Auth] Token 刷新失败:', e instanceof Error ? e.message : e);
      // 刷新失败，可能 refresh_token 已过期，需要重新登录
      get().logout();
    }
  },

  startAutoRefresh: () => {
    const { refreshTimer } = get();
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    // 每 14 分钟刷新一次（Access Token 有效期 15 分钟，提前 1 分钟刷新）
    const timer = setInterval(() => {
      const { isLoggedIn, refreshToken } = get();
      if (isLoggedIn && refreshToken) {
        console.log('[Auth] 自动刷新 Token...');
        get().refreshSession();
      }
    }, ACCESS_TOKEN_EXPIRES_MS - REFRESH_BUFFER_MS);

    set({ refreshTimer: timer });
  },

  stopAutoRefresh: () => {
    const { refreshTimer } = get();
    if (refreshTimer) {
      clearInterval(refreshTimer);
      set({ refreshTimer: null });
    }
  },

  switchRole: async (targetRole: 'customer' | 'admin' | 'rider') => {
    const codeMap = {
      admin: 'admin_code',
      customer: 'customer_code',
      rider: 'rider_code',
    };
    const code = codeMap[targetRole];
    set({ isLoading: true });
    try {
      const response: ApiResponse<LoginResponse> = await post(
        '/auth/wechat-login',
        { code },
        { showError: true },
      );

      const { token, refreshToken, userId, openid, role } = response.data;
      const user: User = { userId, openid, role };

      Taro.setStorageSync('token', token);
      Taro.setStorageSync('refreshToken', refreshToken);
      Taro.setStorageSync('user', JSON.stringify(user));

      set({
        token,
        refreshToken,
        user,
        isLoggedIn: true,
        isLoading: false,
      });

      // 重启自动刷新
      get().stopAutoRefresh();
      get().startAutoRefresh();

      const labelMap = { admin: '商家', customer: '顾客', rider: '骑手' };
      Taro.showToast({ title: `已切换为${labelMap[targetRole]}视角`, icon: 'success' });
      
      // 切换后跳转到对应页面
      setTimeout(() => {
        if (targetRole === 'admin') {
          Taro.reLaunch({ url: '/pages/admin/index' });
        } else if (targetRole === 'rider') {
          Taro.reLaunch({ url: '/pages/rider/index' });
        } else {
          Taro.switchTab({ url: '/pages/menu/index' });
        }
      }, 800);
    } catch (error: any) {
      set({ isLoading: false });
      throw error;
    }
  },

  getRoleLabel: (role: string): string => {
    switch (role) {
      case 'admin':
        return '👨‍🍳 商家';
      case 'customer':
      case 'guest':
        return '🛒 顾客';
      case 'rider':
        return '🛵 骑手';
      default:
        return role;
    }
  },
}));
