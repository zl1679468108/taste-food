import { get, post, patch, RequestError, isRetryableError } from '../../src/utils/request';
import { clearCache } from '../../src/utils/cache';

jest.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: {
    request: jest.fn(),
    getStorageSync: jest.fn(),
    setStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
    showToast: jest.fn(),
    reLaunch: jest.fn(),
    getCurrentPages: jest.fn(() => [{ route: 'pages/menu/index' }]),
    getNetworkType: jest.fn(async () => ({ networkType: 'wifi' })),
  },
}));

const authStoreMocks = {
  logout: jest.fn(),
  stopAutoRefresh: jest.fn(),
  refreshSession: jest.fn(async () => undefined),
};

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: {
    getState: () => authStoreMocks,
  },
}));

import Taro from '@tarojs/taro';
import { API_BASE_URL } from '../../src/env';

const mockTaro = Taro as any;

describe('request utils', () => {
  const mockResponse = {
    statusCode: 200,
    data: { code: 0, data: { message: 'success' }, message: 'success' },
  };

  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
    mockTaro.request.mockResolvedValue(mockResponse);
    mockTaro.getNetworkType.mockResolvedValue({ networkType: 'wifi' });
    mockTaro.getStorageSync.mockReturnValue(null);
    authStoreMocks.refreshSession.mockImplementation(async () => {
      mockTaro.getStorageSync.mockImplementation((key: string) => {
        if (key === 'token') return 'refreshed-token';
        return null;
      });
    });
  });

  test('get should call Taro.request with correct parameters', async () => {
    await get('/test', { param: 'value' });
    expect(mockTaro.request).toHaveBeenCalledWith({
      url: `${API_BASE_URL}/test`,
      method: 'GET',
      data: { param: 'value' },
      header: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
  });

  test('post should call Taro.request with correct parameters', async () => {
    await post('/test', { data: 'test' });
    expect(mockTaro.request).toHaveBeenCalledWith({
      url: `${API_BASE_URL}/test`,
      method: 'POST',
      data: { data: 'test' },
      header: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
  });

  test('get should reuse cached data before ttl expires', async () => {
    await get('/cached', { page: 1 });
    await get('/cached', { page: 1 });

    expect(mockTaro.request).toHaveBeenCalledTimes(1);
  });

  test('mutation should invalidate matching resource cache', async () => {
    await get('/menu-items', { shop_id: 'shop001' });
    mockTaro.request.mockClear();

    await patch('/menu-items/item-1', { name: 'new name' });
    await get('/menu-items', { shop_id: 'shop001' });

    expect(mockTaro.request).toHaveBeenCalledTimes(2);
  });

  test('RequestError should be created with correct properties', () => {
    const error = new RequestError('test message', 500);
    expect(error.message).toBe('test message');
    expect(error.code).toBe(500);
    expect(error.name).toBe('RequestError');
    expect(error.retryable).toBe(true);
  });

  test('get should handle network errors and retry once', async () => {
    mockTaro.request
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(mockResponse);

    const result = await get('/test', undefined, { retryDelay: 1 });
    expect(result.code).toBe(0);
    expect(mockTaro.request).toHaveBeenCalledTimes(2);
  });

  test('get should toast after network retries exhausted', async () => {
    mockTaro.request.mockRejectedValue(new Error('Network request failed'));
    await expect(get('/test', undefined, { retries: 1, retryDelay: 1 })).rejects.toThrow(
      '网络连接失败，请检查网络',
    );
    expect(mockTaro.showToast).toHaveBeenCalledWith({
      title: '网络连接失败，请检查网络',
      icon: 'none',
    });
    // first + 1 retry
    expect(mockTaro.request).toHaveBeenCalledTimes(2);
  });

  test('get should warn on weak network', async () => {
    mockTaro.getNetworkType.mockResolvedValue({ networkType: '2g' });
    await get('/test');
    expect(mockTaro.showToast).toHaveBeenCalledWith({
      title: '当前网络较弱，加载可能较慢',
      icon: 'none',
    });
  });

  test('get should refresh on biz code 1004 then retry original request', async () => {
    mockTaro.getStorageSync.mockReturnValue('old-token');
    mockTaro.request
      .mockResolvedValueOnce({
        ...mockResponse,
        data: { code: 1004, data: null, message: '无效的 token 或已过期' },
      })
      .mockResolvedValueOnce(mockResponse);

    const result = await get('/favorites');
    expect(result.code).toBe(0);
    expect(authStoreMocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mockTaro.request).toHaveBeenCalledTimes(2);
    expect(mockTaro.request.mock.calls[1][0].header.Authorization).toBe('Bearer refreshed-token');
    expect(mockTaro.showToast).not.toHaveBeenCalledWith({
      title: '无效的 token 或已过期',
      icon: 'none',
    });
  });

  test('get should logout when refresh cannot recover unauthorized', async () => {
    mockTaro.getStorageSync.mockReturnValue('old-token');
    authStoreMocks.refreshSession.mockImplementation(async () => {
      // refresh 后 token 仍在，但业务仍 1004
      mockTaro.getStorageSync.mockReturnValue('old-token');
    });
    mockTaro.request.mockResolvedValue({
      ...mockResponse,
      data: { code: 1004, data: null, message: '无效的 token 或已过期' },
    });

    await expect(get('/favorites')).rejects.toThrow('无效的 token 或已过期');
    expect(authStoreMocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mockTaro.showToast).toHaveBeenCalledWith({
      title: '登录已过期，请重新登录',
      icon: 'none',
    });
  });

  test('get should still treat legacy code 401 as unauthorized', async () => {
    mockTaro.getStorageSync.mockReturnValue('old-token');
    mockTaro.request
      .mockResolvedValueOnce({
        ...mockResponse,
        data: { code: 401, data: null, message: 'Unauthorized' },
      })
      .mockResolvedValueOnce(mockResponse);

    const result = await get('/test');
    expect(result.code).toBe(0);
    expect(authStoreMocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mockTaro.request).toHaveBeenCalledTimes(2);
  });

  test('post login credential error 1004 without token should toast business message', async () => {
    mockTaro.getStorageSync.mockReturnValue(null);
    mockTaro.request.mockResolvedValue({
      ...mockResponse,
      statusCode: 401,
      data: { code: 1004, data: null, message: '用户名或密码错误' },
    });

    await expect(post('/auth/login', { username: 'x', password: 'y' })).rejects.toThrow(
      '用户名或密码错误',
    );
    expect(authStoreMocks.refreshSession).not.toHaveBeenCalled();
    expect(mockTaro.showToast).toHaveBeenCalledWith({
      title: '用户名或密码错误',
      icon: 'none',
    });
  });

  test('post with skipAuthRedirect should toast 1004 as normal business error', async () => {
    mockTaro.getStorageSync.mockReturnValue('stale-token');
    mockTaro.request.mockResolvedValue({
      ...mockResponse,
      statusCode: 401,
      data: { code: 1004, data: null, message: '用户名或密码错误' },
    });

    await expect(
      post('/auth/login', { username: 'x', password: 'bad' }, { skipAuthRedirect: true }),
    ).rejects.toThrow('用户名或密码错误');
    expect(authStoreMocks.refreshSession).not.toHaveBeenCalled();
    expect(mockTaro.showToast).toHaveBeenCalledWith({
      title: '用户名或密码错误',
      icon: 'none',
    });
  });

  test('get unauthorized without token should toast instead of silent throw', async () => {
    mockTaro.getStorageSync.mockReturnValue(null);
    mockTaro.request.mockResolvedValue({
      ...mockResponse,
      data: { code: 1004, data: null, message: '请先登录' },
    });

    await expect(get('/favorites')).rejects.toThrow('请先登录');
    expect(authStoreMocks.refreshSession).not.toHaveBeenCalled();
    expect(mockTaro.showToast).toHaveBeenCalledWith({
      title: '请先登录',
      icon: 'none',
    });
  });

  test('business error without message should still toast fallback', async () => {
    mockTaro.request.mockResolvedValue({
      ...mockResponse,
      data: { code: 1001, data: null, message: '' },
    });

    await expect(post('/auth/register', { username: 'ab' })).rejects.toThrow('请求失败');
    expect(mockTaro.showToast).toHaveBeenCalledWith({
      title: '请求失败',
      icon: 'none',
    });
  });

  test('isRetryableError detects network errors', () => {
    expect(isRetryableError(new RequestError('net', -1, { isNetworkError: true }))).toBe(true);
    expect(isRetryableError(new RequestError('bad', 400))).toBe(false);
  });
});
