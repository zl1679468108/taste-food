import { useAuthStore } from '../../src/stores/authStore';
import Taro from '@tarojs/taro';

// Mock Taro storage
var mockTaro = {
  setStorageSync: jest.fn(),
  getStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  reLaunch: jest.fn(),
  switchTab: jest.fn(),
  showToast: jest.fn(),
};
mockTaro.default = mockTaro;
mockTaro.__esModule = true;

jest.mock('@tarojs/taro', () => mockTaro);

describe('authStore', () => {
  const { login, logout, setToken, restoreToken, refreshSession, switchRole, getRoleLabel } = useAuthStore.getState();

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  test('restoreToken should return false when no storage data', () => {
    mockTaro.getStorageSync.mockReturnValue(null);
    expect(restoreToken()).toBe(false);
  });

  test('restoreToken should return true when storage data exists', () => {
    mockTaro.getStorageSync.mockReturnValueOnce('token');
    mockTaro.getStorageSync.mockReturnValueOnce('refreshToken');
    mockTaro.getStorageSync.mockReturnValueOnce(JSON.stringify({ userId: '1', openid: 'openid', role: 'customer' }));
    
    expect(restoreToken()).toBe(true);
    expect(mockTaro.setStorageSync).toHaveBeenCalledWith('token', 'token');
    expect(mockTaro.setStorageSync).toHaveBeenCalledWith('refreshToken', 'refreshToken');
    expect(mockTaro.setStorageSync).toHaveBeenCalledWith('user', JSON.stringify({ userId: '1', openid: 'openid', role: 'customer' }));
  });

  test('getRoleLabel should return correct labels', () => {
    expect(getRoleLabel('admin')).toBe('👨‍🍳 商家');
    expect(getRoleLabel('customer')).toBe('🛒 顾客');
    expect(getRoleLabel('rider')).toBe('🛵 骑手');
    expect(getRoleLabel('unknown')).toBe('unknown');
  });

  test('switchRole should handle different roles', () => {
    const showToast = mockTaro.showToast as jest.Mock;
    const reLaunch = mockTaro.reLaunch as jest.Mock;
    const switchTab = mockTaro.switchTab as jest.Mock;

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
