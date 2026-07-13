import { useAuthStore } from './authStore';
import Taro from '@tarojs/taro';
import { post } from '../utils/request';

// Mock Taro storage
var mockTaro = {
  setStorageSync: jest.fn(),
  getStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  reLaunch: jest.fn(),
  switchTab: jest.fn(),
  showToast: jest.fn(),
};

jest.mock('@tarojs/taro', () => ({
  __esModule: true,
  ...mockTaro,
  default: mockTaro,
}));
jest.mock('../utils/request', () => ({
  post: jest.fn(),
}));

describe('authStore', () => {
  const { login, logout, setToken, restoreToken, refreshSession, switchRole, getRoleLabel } = useAuthStore.getState();
  const mockPost = post as jest.Mock;
  const taro = require('@tarojs/taro').default || require('@tarojs/taro');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockPost.mockImplementation((_url, data) => {
      const role = data.code.replace('_code', '');
      return Promise.resolve({
        code: 0,
        data: {
          token: `${role}-token`,
          refreshToken: `${role}-refresh-token`,
          userId: `${role}-user`,
          openid: `${role}-openid`,
          role,
        },
        message: 'success',
      });
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('restoreToken should return false when no storage data', () => {
    taro.getStorageSync.mockReturnValue(null);
    expect(restoreToken()).toBe(false);
  });

  test('restoreToken should return true when storage data exists', () => {
    taro.getStorageSync.mockReturnValueOnce('token');
    taro.getStorageSync.mockReturnValueOnce('refreshToken');
    taro.getStorageSync.mockReturnValueOnce(JSON.stringify({ userId: '1', openid: 'openid', role: 'customer' }));
    
    expect(restoreToken()).toBe(true);
    expect(useAuthStore.getState()).toMatchObject({
      token: 'token',
      refreshToken: 'refreshToken',
      user: { userId: '1', openid: 'openid', role: 'customer' },
      isLoggedIn: true,
    });
  });

  test('getRoleLabel should return correct labels', () => {
    expect(getRoleLabel('admin')).toBe('👨‍🍳 商家');
    expect(getRoleLabel('customer')).toBe('🛒 顾客');
    expect(getRoleLabel('rider')).toBe('🛵 骑手');
    expect(getRoleLabel('unknown')).toBe('unknown');
  });

  test('switchRole should handle different roles', async () => {
    const showToast = taro.showToast as jest.Mock;
    const reLaunch = taro.reLaunch as jest.Mock;
    const switchTab = taro.switchTab as jest.Mock;

    await switchRole('admin');
    expect(showToast).toHaveBeenCalledWith({ title: '已切换为商家视角', icon: 'success' });
    jest.advanceTimersByTime(800);
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/admin/index' });

    await switchRole('customer');
    expect(showToast).toHaveBeenCalledWith({ title: '已切换为顾客视角', icon: 'success' });
    jest.advanceTimersByTime(800);
    expect(switchTab).toHaveBeenCalledWith({ url: '/pages/menu/index' });

    await switchRole('rider');
    expect(showToast).toHaveBeenCalledWith({ title: '已切换为骑手视角', icon: 'success' });
    jest.advanceTimersByTime(800);
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/rider/index' });
  });
});
