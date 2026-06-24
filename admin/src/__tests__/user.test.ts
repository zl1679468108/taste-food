import { getUsers, getUser } from '../services/user';

// Mock request
jest.mock('../utils/request', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));

describe('User API 服务', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { items: [], total: 0 };
      const request = require('../utils/request');
      request.get.mockResolvedValue(mockResponse);

      const params = { page: 1, pageSize: 10 };
      await getUsers(params);

      expect(request.get).toHaveBeenCalledWith('/api/users', { params });
    });
  });

  describe('getUser', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { id: 'user123', nickName: '测试用户' };
      const request = require('../utils/request');
      request.get.mockResolvedValue(mockResponse);

      await getUser('user123');

      expect(request.get).toHaveBeenCalledWith('/api/users/user123');
    });
  });
});