import { get, post, put, del, patch } from './request';
import Taro from '@tarojs/taro';
import { RequestError } from './request';

// Mock Taro request
jest.mock('@tarojs/taro', () => ({
  __esModule: true,
  request: jest.fn(),
  getStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  showToast: jest.fn(),
  reLaunch: jest.fn(),
  getCurrentPages: jest.fn(() => [{ route: 'pages/menu/index' }]),
  default: {
    request: jest.fn(),
    getStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
    showToast: jest.fn(),
    reLaunch: jest.fn(),
    getCurrentPages: jest.fn(() => [{ route: 'pages/menu/index' }]),
  },
}));

describe('request utils', () => {
  const mockResponse = {
    statusCode: 200,
    data: { code: 0, data: { message: 'success' }, message: 'success' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Taro.request.mockResolvedValue(mockResponse);
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
  });

  test('get should handle network errors', async () => {
    Taro.request.mockRejectedValue(new Error('Network request failed'));
    await expect(get('/test')).rejects.toThrow('网络连接失败，请检查网络');
    expect(Taro.showToast).toHaveBeenCalledWith({ title: '网络连接失败，请检查网络', icon: 'none' });
  });

  test('get should handle 401 errors', async () => {
    const errorResponse = { ...mockResponse, data: { code: 401, message: 'Unauthorized' } };
    Taro.request.mockResolvedValue(errorResponse);
    await expect(get('/test')).rejects.toThrow('Unauthorized');
    expect(Taro.removeStorageSync).toHaveBeenCalledWith('token');
    expect(Taro.showToast).toHaveBeenCalledWith({ title: '登录已过期，请重新登录', icon: 'none' });
  });
});
