import { get, post, RequestError, isRetryableError } from './request';
import Taro from '@tarojs/taro';

// Mock Taro request
jest.mock('@tarojs/taro', () => ({
  __esModule: true,
  request: jest.fn(),
  getStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  showToast: jest.fn(),
  reLaunch: jest.fn(),
  getCurrentPages: jest.fn(() => [{ route: 'pages/menu/index' }]),
  getNetworkType: jest.fn(async () => ({ networkType: 'wifi' })),
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

jest.mock('../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      logout: jest.fn(),
      stopAutoRefresh: jest.fn(),
    }),
  },
}));

describe('request utils', () => {
  const mockResponse = {
    statusCode: 200,
    data: { code: 0, data: { message: 'success' }, message: 'success' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Taro.request as jest.Mock).mockResolvedValue(mockResponse);
    (Taro.getNetworkType as jest.Mock).mockResolvedValue({ networkType: 'wifi' });
  });

  test('get should call Taro.request with correct parameters', async () => {
    await get('/test', { param: 'value' });
    expect(Taro.request).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:3010/api/test',
      method: 'GET',
      data: { param: 'value' },
      header: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
  });

  test('post should call Taro.request with correct parameters', async () => {
    await post('/test', { data: 'test' });
    expect(Taro.request).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:3010/api/test',
      method: 'POST',
      data: { data: 'test' },
      header: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
  });

  test('RequestError should be created with correct properties', () => {
    const error = new RequestError('test message', 500);
    expect(error.message).toBe('test message');
    expect(error.code).toBe(500);
    expect(error.name).toBe('RequestError');
    expect(error.retryable).toBe(true);
  });

  test('get should handle network errors and retry once', async () => {
    (Taro.request as jest.Mock)
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(mockResponse);

    const result = await get('/test', undefined, { retryDelay: 1 });
    expect(result.code).toBe(0);
    expect(Taro.request).toHaveBeenCalledTimes(2);
  });

  test('get should toast after network retries exhausted', async () => {
    (Taro.request as jest.Mock).mockRejectedValue(new Error('Network request failed'));
    await expect(get('/test', undefined, { retries: 1, retryDelay: 1 })).rejects.toThrow(
      '网络连接失败，请检查网络',
    );
    expect(Taro.showToast).toHaveBeenCalledWith({
      title: '网络连接失败，请检查网络',
      icon: 'none',
    });
    // first + 1 retry
    expect(Taro.request).toHaveBeenCalledTimes(2);
  });

  test('get should warn on weak network', async () => {
    (Taro.getNetworkType as jest.Mock).mockResolvedValue({ networkType: '2g' });
    await get('/test');
    expect(Taro.showToast).toHaveBeenCalledWith({
      title: '当前网络较弱，加载可能较慢',
      icon: 'none',
    });
  });

  test('get should not retry 401', async () => {
    const errorResponse = {
      ...mockResponse,
      data: { code: 401, message: 'Unauthorized' },
    };
    (Taro.request as jest.Mock).mockResolvedValue(errorResponse);
    await expect(get('/test')).rejects.toThrow('Unauthorized');
    expect(Taro.request).toHaveBeenCalledTimes(1);
    expect(Taro.showToast).toHaveBeenCalledWith({
      title: '登录已过期，请重新登录',
      icon: 'none',
    });
  });

  test('isRetryableError detects network errors', () => {
    expect(isRetryableError(new RequestError('net', -1, { isNetworkError: true }))).toBe(true);
    expect(isRetryableError(new RequestError('bad', 400))).toBe(false);
  });
});
