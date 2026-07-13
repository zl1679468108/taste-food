import { getCategories, createCategory, updateCategory, deleteCategory, getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem } from '../services/menu';

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

describe('Menu API 服务', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCategories', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse: unknown[] = [];
      const request = require('../utils/request').default;
      request.get.mockResolvedValue(mockResponse);

      await getCategories('shop001');

      expect(request.get).toHaveBeenCalledWith('/api/categories', { params: { shop_id: 'shop001' } });
    });
  });

  describe('createCategory', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { id: 'cat123', name: '测试分类' };
      const request = require('../utils/request').default;
      request.post.mockResolvedValue(mockResponse);

      const data = { name: '测试分类', shopId: 'shop001' };
      await createCategory(data);

      expect(request.post).toHaveBeenCalledWith('/api/categories', data);
    });
  });

  describe('updateCategory', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { id: 'cat123', name: '更新分类' };
      const request = require('../utils/request').default;
      request.patch.mockResolvedValue(mockResponse);

      const data = { name: '更新分类' };
      await updateCategory('cat123', data);

      expect(request.patch).toHaveBeenCalledWith('/api/categories/cat123', data);
    });
  });

  describe('deleteCategory', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { success: true };
      const request = require('../utils/request').default;
      request.delete.mockResolvedValue(mockResponse);

      await deleteCategory('cat123');

      expect(request.delete).toHaveBeenCalledWith('/api/categories/cat123');
    });
  });

  describe('getMenuItems', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse: unknown[] = [];
      const request = require('../utils/request').default;
      request.get.mockResolvedValue(mockResponse);

      const params = { shop_id: 'shop001' };
      await getMenuItems(params);

      expect(request.get).toHaveBeenCalledWith('/api/menu-items', { params });
    });
  });

  describe('createMenuItem', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { id: 'item123', name: '测试菜品' };
      const request = require('../utils/request').default;
      request.post.mockResolvedValue(mockResponse);

      const data = { name: '测试菜品', price: 1000 };
      await createMenuItem(data);

      expect(request.post).toHaveBeenCalledWith('/api/menu-items', data);
    });
  });

  describe('updateMenuItem', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { id: 'item123', name: '更新菜品' };
      const request = require('../utils/request').default;
      request.patch.mockResolvedValue(mockResponse);

      const data = { name: '更新菜品' };
      await updateMenuItem('item123', data);

      expect(request.patch).toHaveBeenCalledWith('/api/menu-items/item123', data);
    });
  });

  describe('deleteMenuItem', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { success: true };
      const request = require('../utils/request').default;
      request.delete.mockResolvedValue(mockResponse);

      await deleteMenuItem('item123');

      expect(request.delete).toHaveBeenCalledWith('/api/menu-items/item123');
    });
  });
});
