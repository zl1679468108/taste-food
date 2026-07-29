import { create } from 'zustand';
import * as TaroImport from '@tarojs/taro';
import { post, get as getRequest } from '../utils/request';
import { ApiResponse } from '../types/api';
import { disconnectSocket } from '../services/socket';

const Taro = (TaroImport as typeof TaroImport & { default?: typeof TaroImport }).default || TaroImport;

/** 可切换业务角色（小程序禁止 admin） */
export type SwitchableRole = 'customer' | 'merchant' | 'rider';

/** 用户多角色项 */
export interface UserRoleItem {
  role: string;
  shopId?: string | null;
  status: string;
}

/** 登录响应 */
export interface LoginResponse {
  token: string;
  refreshToken: string;
  userId: string;
  openid: string;
  role: string;
  shopId?: string;
  nickName?: string;
  username?: string;
  phone?: string;
  roles?: UserRoleItem[];
}

/** 用户信息 */
export interface User {
  userId: string;
  openid: string;
  role: string;
  nickName?: string;
  username?: string;
  phone?: string;
  shopId?: string;
  avatarUrl?: string;
  roles?: UserRoleItem[];
}

export interface RegisterPayload {
  username: string;
  password: string;
  nickName?: string;
  phone?: string;
  intentRole?: 'customer' | 'merchant' | 'rider';
}

export interface WechatProfile {
  nickName?: string;
  avatarUrl?: string;
}

/** Auth Store 状态 */
interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  refreshTimer: NodeJS.Timeout | null;

  /** 微信登录 */
  login: (code: string, profile?: WechatProfile) => Promise<User>;
  /** 账号密码登录 */
  passwordLogin: (username: string, password: string) => Promise<User>;
  /** 账号密码注册 */
  register: (payload: RegisterPayload) => Promise<User>;
  /** 拉取最新资料与角色 */
  fetchMe: () => Promise<User | null>;
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
  /**
   * 切换角色（POST /auth/switch-role）
   * 小程序禁止切到 admin
   */
  switchRole: (targetRole: SwitchableRole, shopId?: string) => Promise<void>;
  /** 获取当前角色显示名称 */
  getRoleLabel: (role: string) => string;
  /** 可切换角色（过滤 admin） */
  getSwitchableRoles: () => UserRoleItem[];
}

// Access Token 有效期：2 小时（与服务端 ACCESS_TOKEN_TTL_MS 默认对齐）
const ACCESS_TOKEN_EXPIRES_MS = 2 * 60 * 60 * 1000;
// 提前 5 分钟刷新
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const isTestEnv = process.env.NODE_ENV === 'test';

function toUser(data: LoginResponse | (Partial<User> & { userId: string; openid: string; role: string })): User {
  return {
    userId: data.userId,
    openid: data.openid || '',
    role: data.role,
    nickName: data.nickName,
    username: 'username' in data ? data.username : undefined,
    phone: 'phone' in data ? data.phone : undefined,
    shopId: data.shopId,
    avatarUrl: 'avatarUrl' in data ? data.avatarUrl : undefined,
    roles: data.roles || [],
  };
}

function persistSession(token: string, refreshToken: string, user: User) {
  Taro.setStorageSync('token', token);
  Taro.setStorageSync('refreshToken', refreshToken);
  Taro.setStorageSync('user', JSON.stringify(user));
}

/** 按角色跳转首页（无 admin 入口） */
export function navigateByRole(role?: string) {
  if (role === 'merchant') {
    Taro.switchTab({ url: '/pages/admin/index' });
    return;
  }
  if (role === 'rider') {
    Taro.switchTab({ url: '/pages/rider/index' });
    return;
  }
  if (role === 'admin') {
    Taro.showToast({ title: '请使用 PC 管理后台', icon: 'none' });
    Taro.switchTab({ url: '/pages/menu/index' });
    return;
  }
  Taro.switchTab({ url: '/pages/menu/index' });
}

export const useAuthStore = create<AuthState>((set, get) => {
  const applyLogin = (data: LoginResponse): User => {
    const user = toUser(data);
    persistSession(data.token, data.refreshToken, user);
    set({
      token: data.token,
      refreshToken: data.refreshToken,
      user,
      isLoggedIn: true,
      isLoading: false,
    });
    get().stopAutoRefresh();
    get().startAutoRefresh();
    return user;
  };

  return {
    token: null,
    refreshToken: null,
    user: null,
    isLoggedIn: false,
    isLoading: false,
    refreshTimer: null,

    login: async (code: string, profile?: WechatProfile) => {
      set({ isLoading: true });
      try {
        const response: ApiResponse<LoginResponse> = await post(
          '/auth/wechat-login',
          {
            code,
            nickName: profile?.nickName,
            avatarUrl: profile?.avatarUrl,
          },
          { showError: true },
        );
        return applyLogin(response.data);
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    passwordLogin: async (username: string, password: string) => {
      set({ isLoading: true });
      try {
        const response: ApiResponse<LoginResponse> = await post(
          '/auth/login',
          { username, password },
          { showError: true },
        );
        return applyLogin(response.data);
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    register: async (payload: RegisterPayload) => {
      set({ isLoading: true });
      try {
        const response: ApiResponse<LoginResponse> = await post(
          '/auth/register',
          payload as unknown as Record<string, unknown>,
          { showError: true },
        );
        return applyLogin(response.data);
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    fetchMe: async () => {
      const { isLoggedIn } = get();
      if (!isLoggedIn) return null;
      try {
        const res: ApiResponse<{
          userId: string;
          openid: string;
          role: string;
          shopId?: string;
          nickName?: string;
          username?: string;
          phone?: string;
          avatarUrl?: string;
          roles?: UserRoleItem[];
        }> = await getRequest('/auth/me', undefined, { showError: false });
        if (res.code !== 0 || !res.data) return get().user;

        const prev = get().user;
        const user: User = {
          userId: res.data.userId,
          openid: res.data.openid || prev?.openid || '',
          role: res.data.role,
          shopId: res.data.shopId,
          nickName: res.data.nickName,
          username: res.data.username,
          phone: res.data.phone,
          avatarUrl: res.data.avatarUrl,
          roles: res.data.roles || [],
        };
        Taro.setStorageSync('user', JSON.stringify(user));
        set({ user });
        return user;
      } catch {
        return get().user;
      }
    },

    logout: () => {
      get().stopAutoRefresh();
      try {
        disconnectSocket();
      } catch (e) {
        console.warn('[Auth] 断开 socket 失败:', e);
      }

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
      persistSession(token, refreshToken, user);
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
          { showError: false, skipAuthRedirect: true },
        );

        if (res.code === 0 && res.data.token) {
          const { token: newToken, refreshToken: newRefreshToken } = res.data;
          Taro.setStorageSync('token', newToken);
          Taro.setStorageSync('refreshToken', newRefreshToken);
          set({ token: newToken, refreshToken: newRefreshToken });

          if (!isTestEnv) {
            console.log('[Auth] Token 刷新成功');
          }
        }
      } catch (e) {
        console.warn('[Auth] Token 刷新失败:', e instanceof Error ? e.message : e);
        const err = e as { code?: number };
        // 仅在明确的未认证（refreshToken 真正过期：业务码 1004 / 兼容 401）时才登出
        // 网络错误、500、接口不存在等情况保留登录状态，避免误登出
        if (err.code === 401 || err.code === 1004) {
          console.warn('[Auth] refreshToken 已过期，需重新登录');
          get().logout();
        } else {
          console.warn('[Auth] 刷新失败但保留登录状态，code:', err.code);
        }
      }
    },

    startAutoRefresh: () => {
      const { refreshTimer } = get();
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }

      const timer = setInterval(() => {
        const { isLoggedIn, refreshToken } = get();
        if (isLoggedIn && refreshToken) {
          if (!isTestEnv) {
            console.log('[Auth] 自动刷新 Token...');
          }
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

    switchRole: async (targetRole: SwitchableRole, shopId?: string) => {
      if (targetRole === ('admin' as SwitchableRole)) {
        Taro.showToast({ title: '小程序不支持管理员角色', icon: 'none' });
        return;
      }

      set({ isLoading: true });
      try {
        const body: Record<string, unknown> = { role: targetRole };
        if (shopId) body.shopId = shopId;

        const response: ApiResponse<LoginResponse> = await post(
          '/auth/switch-role',
          body,
          { showError: true },
        );
        applyLogin(response.data);

        const label = get().getRoleLabel(targetRole);
        Taro.showToast({ title: `已切换为${label}`, icon: 'success' });

        setTimeout(() => {
          navigateByRole(targetRole);
        }, 800);
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    getRoleLabel: (role: string): string => {
      switch (role) {
        case 'merchant':
          return '商家';
        case 'admin':
          return '管理员';
        case 'customer':
        case 'guest':
          return '顾客';
        case 'rider':
          return '骑手';
        default:
          return role;
      }
    },

    getSwitchableRoles: () => {
      const roles = get().user?.roles || [];
      const activeRoles = roles.filter((r) => r.status === 'active' && r.role !== 'admin');
      if (!activeRoles.some((r) => r.role === 'customer')) {
        return [{ role: 'customer', shopId: null, status: 'active' }, ...activeRoles];
      }
      return activeRoles;
    },
  };
});
