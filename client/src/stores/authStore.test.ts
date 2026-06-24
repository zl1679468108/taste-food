import { useAuthStore } from './authStore';
import Taro from '@tarojs/taro';

// Mock Taro storage
jest.mock('@tarojs/taro', () => ({
  setStorageSync: jest.fn(),
  getStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  reLaunch: jest.fn(),
  switchTab: jest.fn(),
  showToast: jest.fn(),
}));

describe('authStore', () => {
  const { login, logout, setToken, restoreToken, refreshSession, switchRole, getRoleLabel } = useAuthStore.getState();

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  test('restoreToken should return false when no storage data', () => {
    Taro.getStorageSync.mockReturnValue(null);
    expect(restoreToken()).toBe(false);
  });

  test('restoreToken should return true when storage data exists', () => {
    Taro.getStorageSync.mockReturnValueOnce('token');
    Taro.getStorageSync.mockReturnValueOnce('refreshToken');
    Taro.getStorageSync.mockReturnValueOnce(JSON.stringify({ userId: '1', openid: 'openid', role: 'customer' }));
    
    expect(restoreToken()).toBe(true);
    expect(Taro.setStorageSync).toHaveBeenCalledWith('token', 'token');
    expect(Taro.setStorageSync).toHaveBeenCalledWith('refreshToken', 'refreshToken');
    expect(Taro.setStorageSync).toHaveBeenCalledWith('user', JSON.stringify({ userId: '1', openid: 'openid', role: 'customer' }));
  });

  test('getRoleLabel should return correct labels', () => {
    expect(getRoleLabel('admin')).toBe('👨‍🍳 商家');
    expect(getRoleLabel('customer')).toBe('🛒 顾客');
    expect(getRoleLabel('rider')).toBe('🛵 骑手');
    expect(getRoleLabel('unknown')).toBe('unknown');
  });

  test('switchRole should handle different roles', () => {
    const showToast = Taro.showToast as jest.Mock;
    const reLaunch = Taro.reLaunch as jest.Mock;
    const switchTab = Taro.switchTab as jest.Mock;

    switchRole('admin');
    expect(showToast).toHaveBeenCalledWith({ title: '已切换为商家视角', icon: 'success' });
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/admin/index' });

    switchRole('customer');
    expect(showToast).toHaveBeenCalledWith({ title: '已切换为顾客视角', icon: 'success' });
    expect(switchTab).toHaveBeenCalledWith({ url: '/pages/menu/index' });

    switchRole('rider');
    expect(showToast).toHaveBeenCalledWith({ title: '已切换为骑手视角', icon: 'success' });
    expect(reLaunch).toHaveBeenCalledWith({ url: '/pages/rider/index' });
  });
});
