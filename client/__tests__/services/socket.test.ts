const socketOn = jest.fn();
const socketOff = jest.fn();
const socketDisconnect = jest.fn();
const socketRemoveAllListeners = jest.fn();
const handlers: Record<string, Function> = {};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: socketOn.mockImplementation((event: string, handler: Function) => {
      handlers[event] = handler;
    }),
    off: socketOff,
    emit: jest.fn(),
    disconnect: socketDisconnect,
    removeAllListeners: socketRemoveAllListeners,
  })),
}));

jest.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: {},
}));

describe('socket service listeners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.resetModules();
  });

  test('keeps multiple order update listeners active', () => {
    const { connectSocket, onOrderUpdated, removeAllListeners } = require('../../src/services/socket');
    const first = jest.fn();
    const second = jest.fn();

    connectSocket('token', 'user-1', 'admin');
    onOrderUpdated(first, 'order-list');
    onOrderUpdated(second, 'order-detail');

    expect(socketOn).toHaveBeenCalledWith('order:updated', expect.any(Function));
    expect(handlers['order:updated']).toEqual(expect.any(Function));

    handlers['order:updated']({ order: { id: 'order-1' }, previousStatus: 'paid' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    removeAllListeners();
    expect(socketOff).toHaveBeenCalledWith('order:updated');
    expect(socketOff).toHaveBeenCalledWith('order:created');
  });
});
