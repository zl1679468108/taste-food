import { getPromotions, createPromotion, updatePromotion, deletePromotion } from '../services/promotion';

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

describe('Promotion API 服务', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPromotions', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse: unknown[] = [];
      const request = require('../utils/request').default;
      request.get.mockResolvedValue(mockResponse);

      await getPromotions('shop001');

      expect(request.get).toHaveBeenCalledWith('/api/promotions/manage');
    });
  });

  describe('createPromotion', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { id: 'promo123', name: '测试促销' };
      const request = require('../utils/request').default;
      request.post.mockResolvedValue(mockResponse);

      const data = { name: '测试促销', type: 'full_discount' };
      await createPromotion(data);

      expect(request.post).toHaveBeenCalledWith('/api/promotions', data);
    });
  });

  describe('updatePromotion', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { id: 'promo123', name: '更新促销' };
      const request = require('../utils/request').default;
      request.patch.mockResolvedValue(mockResponse);

      const data = { name: '更新促销' };
      await updatePromotion('promo123', data);

      expect(request.patch).toHaveBeenCalledWith('/api/promotions/promo123', data);
    });
  });

  describe('deletePromotion', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { success: true };
      const request = require('../utils/request').default;
      request.delete.mockResolvedValue(mockResponse);

      await deletePromotion('promo123');

      expect(request.delete).toHaveBeenCalledWith('/api/promotions/promo123');
    });
  });
});
