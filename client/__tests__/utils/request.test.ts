import { get, post, patch, RequestError, isRetryableError } from '../../src/utils/request';
import { clearCache } from '../../src/utils/cache';

jest.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: {
    request: jest.fn(),
    getStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
    showToast: jest.fn(),
    reLaunch: jest.fn(),
    getCurrentPages: jest.fn(() => [{ route: 'pages/menu/index' }]),
    getNetworkType: jest.fn(async () => ({ networkType: 'wifi' })),
  },
}));

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      logout: jest.fn(),
      stopAutoRefresh: jest.fn(),
    }),
  },
}));

import Taro from '@tarojs/taro';

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
  });

  test('get should call Taro.request with correct parameters', async () => {
    await get('/test', { param: 'value' });
    expect(mockTaro.request).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:3010/api/test',
      method: 'GET',
      data: { param: 'value' },
      header: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
  });

  test('post should call Taro.request with correct parameters', async () => {
    await post('/test', { data: 'test' });
    expect(mockTaro.request).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:3010/api/test',
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

  test('get should not retry 401', async () => {
    const errorResponse = {
      ...mockResponse,
      data: { code: 401, message: 'Unauthorized' },
    };
    mockTaro.request.mockResolvedValue(errorResponse);
    await expect(get('/test')).rejects.toThrow('Unauthorized');
    expect(mockTaro.request).toHaveBeenCalledTimes(1);
    expect(mockTaro.removeStorageSync).toHaveBeenCalledWith('token');
    expect(mockTaro.showToast).toHaveBeenCalledWith({
      title: '登录已过期，请重新登录',
      icon: 'none',
    });
  });

  test('isRetryableError detects network errors', () => {
    expect(isRetryableError(new RequestError('net', -1, { isNetworkError: true }))).toBe(true);
    expect(isRetryableError(new RequestError('bad', 400))).toBe(false);
  });
});
