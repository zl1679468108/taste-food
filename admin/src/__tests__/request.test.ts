import request from '../utils/request';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
})),
}));

describe('request 工具', () => {
  it('应该导出 request 实例', () => {
    expect(request).toBeDefined();
  });

  it('应该有 get 方法', () => {
    expect(request.get).toBeDefined();
  });

  it('应该有 post 方法', () => {
    expect(request.post).toBeDefined();
  });

  it('应该有 patch 方法', () => {
    expect(request.patch).toBeDefined();
  });

it('应该有 delete 方法', () => {
  expect(request.delete).toBeDefined();
});
it('应该有 put 方法', () => {
  expect(request.put).toBeDefined();
});
});