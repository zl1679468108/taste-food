jest.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn(),
    setStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
  },
}));

import Taro from '@tarojs/taro';
import {
  getCache,
  setCache,
  clearCache,
  getStorageCache,
  setStorageCache,
  getCacheResourceKey,
  clearResourceCache,
} from '../../src/utils/cache';

const mockTaro = Taro as any;

describe('cache utils', () => {
  beforeEach(() => {
    clearCache();
    jest.clearAllMocks();
  });

  test('setCache and getCache should work correctly', () => {
    const testData = { id: 1, name: 'test' };
    setCache('test-key', testData);
    expect(getCache('test-key')).toEqual(testData);
  });

  test('getCache should return null for non-existent key', () => {
    expect(getCache('non-existent-key')).toBeNull();
  });

  test('clearCache should clear all cache', () => {
    setCache('key1', { data: 'test1' });
    setCache('key2', { data: 'test2' });
    clearCache();
    expect(getCache('key1')).toBeNull();
    expect(getCache('key2')).toBeNull();
  });

  test('clearCache should clear cache matching pattern', () => {
    setCache('api/categories', { data: 'categories' });
    setCache('api/menu-items', { data: 'menu-items' });
    setCache('other-key', { data: 'other' });
    clearCache('api/categories');
    expect(getCache('api/categories')).toBeNull();
    expect(getCache('api/menu-items')).not.toBeNull();
    expect(getCache('other-key')).not.toBeNull();
  });

  test('getCacheResourceKey should normalize api urls', () => {
    expect(getCacheResourceKey('/menu-items/1')).toBe('menu-items');
    expect(getCacheResourceKey('/api/orders/1/status')).toBe('orders');
    expect(getCacheResourceKey('http://127.0.0.1:3010/api/categories?shop_id=1')).toBe('categories');
  });

  test('clearResourceCache should clear resource-related keys', () => {
    setCache('GET:http://127.0.0.1:3010/api/menu-items:{}', { data: 'items' });
    setCache('GET:http://127.0.0.1:3010/api/categories:{}', { data: 'categories' });

    clearResourceCache('/menu-items/1');

    expect(getCache('GET:http://127.0.0.1:3010/api/menu-items:{}')).toBeNull();
    expect(getCache('GET:http://127.0.0.1:3010/api/categories:{}')).not.toBeNull();
  });

  test('setStorageCache and getStorageCache should work correctly', () => {
    const testData = { id: 1, name: 'storage test' };
    setStorageCache('storage-key', testData);
    mockTaro.getStorageSync.mockReturnValueOnce(JSON.stringify({ data: testData, timestamp: Date.now() }));
    expect(getStorageCache('storage-key')).toEqual(testData);
  });

  test('getStorageCache should return null for expired cache', () => {
    const expiredEntry = { data: 'expired', timestamp: Date.now() - 10 * 60 * 1000 };
    mockTaro.getStorageSync.mockReturnValueOnce(JSON.stringify(expiredEntry));
    expect(getStorageCache('expired-key')).toBeNull();
    expect(mockTaro.removeStorageSync).toHaveBeenCalledWith('cache_expired-key');
  });

  test('getStorageCache should handle parsing errors', () => {
    mockTaro.getStorageSync.mockReturnValueOnce('invalid json');
    expect(getStorageCache('invalid-key')).toBeNull();
  });
});
