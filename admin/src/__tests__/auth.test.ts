import { login, loginAsAdmin, getCurrentUser } from '@/services/auth';

// Mock request —— 实际 request.ts 为 default export
jest.mock('@/utils/request', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const request = require('@/utils/request').default;

// Mock localStorage（jsdom 默认有 localStorage，但确保可被 jest.fn 监听）
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Auth API 服务', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('login', () => {
    it('应该调用正确的 API 路径', async () => {
      const mockResponse = { token: 'test-token', userId: 'user123' };
      request.post.mockResolvedValue(mockResponse);

      const params = { code: 'admin_code', nickName: '管理员' };
      await login(params);

      expect(request.post).toHaveBeenCalledWith('/api/auth/wechat-login', params);
    });
  });

  describe('loginAsAdmin', () => {
    it('应该使用 admin_code 登录', async () => {
      const mockResponse = { token: 'test-token', userId: 'user123' };
      request.post.mockResolvedValue(mockResponse);

      await loginAsAdmin();

      expect(request.post).toHaveBeenCalledWith('/api/auth/wechat-login', {
        code: 'admin_code',
        nickName: '管理员',
      });
    });
  });

  describe('getCurrentUser', () => {
    it('应该从 localStorage 获取用户信息', async () => {
      const mockUser = { userId: 'user123', role: 'admin' };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

      const user = await getCurrentUser();

      expect(localStorageMock.getItem).toHaveBeenCalledWith('user');
      expect(user).toEqual(mockUser);
    });

    it('应该在没有用户信息时返回 null', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const user = await getCurrentUser();

      expect(user).toBeNull();
    });
  });
});
