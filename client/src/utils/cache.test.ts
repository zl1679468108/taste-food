import { getCache, setCache, clearCache, getStorageCache, setStorageCache } from './cache';
import Taro from '@tarojs/taro';

// Mock Taro storage
jest.mock('@tarojs/taro', () => ({
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
}));

const mockTaro = Taro as any;

describe('cache utils', () => {
  beforeEach(() => {
    // Clear in-memory cache
    clearCache();
    jest.clearAllMocks();
  });

  test('setCache and getCache should work correctly', () => {
    const testData = { id: 1, name: 'test' };
    setCache('test-key', testData);
    const cached = getCache('test-key');
    expect(cached).toEqual(testData);
  });

  test('getCache should return null for non-existent key', () => {
    const cached = getCache('non-existent-key');
    expect(cached).toBeNull();
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

  test('setStorageCache and getStorageCache should work correctly', () => {
    const testData = { id: 1, name: 'storage test' };
    setStorageCache('storage-key', testData);
    
    mockTaro.getStorageSync.mockReturnValueOnce(JSON.stringify({ data: testData, timestamp: Date.now() }));
    const cached = getStorageCache('storage-key');
    expect(cached).toEqual(testData);
  });

  test('getStorageCache should return null for expired cache', () => {
    const expiredEntry = { data: 'expired', timestamp: Date.now() - 10 * 60 * 1000 };
    mockTaro.getStorageSync.mockReturnValueOnce(JSON.stringify(expiredEntry));
    const cached = getStorageCache('expired-key');
    expect(cached).toBeNull();
    expect(mockTaro.removeStorageSync).toHaveBeenCalledWith('cache_expired-key');
  });

  test('getStorageCache should handle parsing errors', () => {
    mockTaro.getStorageSync.mockReturnValueOnce('invalid json');
    const cached = getStorageCache('invalid-key');
    expect(cached).toBeNull();
  });
});
