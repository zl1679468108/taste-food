import { getShops, getShop, updateShopStatus } from '../services/shop';

// Mock request
jest.mock('../utils/request', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

describe('Shop API 服务', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getShops', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = [{ id: 'shop001', name: '测试店铺' }];
      const request = require('../utils/request');
      request.get.mockResolvedValue(mockResponse);

      await getShops();

      expect(request.get).toHaveBeenCalledWith('/api/shops');
    });
  });

  describe('getShop', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { id: 'shop001', name: '测试店铺' };
      const request = require('../utils/request');
      request.get.mockResolvedValue(mockResponse);

      await getShop('shop001');

      expect(request.get).toHaveBeenCalledWith('/api/shops/shop001');
    });
  });

  describe('updateShopStatus', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { id: 'shop001', status: 'open' };
      const request = require('../utils/request');
      request.patch.mockResolvedValue(mockResponse);

      await updateShopStatus('shop001', 'open');

      expect(request.patch).toHaveBeenCalledWith('/api/shops/shop001/status', { status: 'open' });
    });
  });
});