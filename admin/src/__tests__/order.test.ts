import { getOrders, getOrderStats, updateOrderStatus } from '../services/order';

// Mock request —— 与 auth.test.ts 保持一致：default export 形式
jest.mock('../utils/request', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Order API 服务', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrders', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { items: [], total: 0 };
      const request = require('../utils/request').default;
      request.get.mockResolvedValue(mockResponse);

      const params = { shop_id: 'shop001', page: 1, pageSize: 10 };
      await getOrders(params);

      expect(request.get).toHaveBeenCalledWith('/api/orders', { params });
    });
  });

  describe('getOrderStats', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { totalOrders: 0, totalRevenue: 0 };
      const request = require('../utils/request').default;
      request.get.mockResolvedValue(mockResponse);

      await getOrderStats('shop001');

      expect(request.get).toHaveBeenCalledWith('/api/orders/stats/shop001');
    });
  });

  describe('updateOrderStatus', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { success: true };
      const request = require('../utils/request').default;
      request.post.mockResolvedValue(mockResponse);

      await updateOrderStatus('order123', 'completed');

      expect(request.post).toHaveBeenCalledWith('/api/orders/order123/status', { status: 'completed' });
    });
  });
});