import Taro from '@tarojs/taro';

jest.useFakeTimers();

const taroMock = {
  setStorageSync: jest.fn(),
  getStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
};

jest.mock('@tarojs/taro', () => taroMock);

describe('cartStore persist debounce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    taroMock.getStorageSync.mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('rapid updates only persist once after debounce window', () => {
    const { useCartStore } = require('../../src/stores/cartStore');
    const store = useCartStore.getState();

    store.addItem({
      menuItemId: '1',
      name: 'Burger',
      price: 1200,
      quantity: 1,
      imageUrl: '',
      specDesc: '',
    });
    store.setRemarks('no onion');
    store.setQuantity(useCartStore.getState().items[0].key, 2);

    expect(taroMock.setStorageSync).not.toHaveBeenCalled();

    jest.advanceTimersByTime(999);
    expect(taroMock.setStorageSync).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(taroMock.setStorageSync).toHaveBeenCalledTimes(1);
    expect(taroMock.setStorageSync).toHaveBeenCalledWith(
      'taste_food_cart',
      expect.objectContaining({
        items: expect.any(Array),
        remarks: 'no onion',
      }),
    );
  });

  test('clearCart persists immediately', () => {
    const { useCartStore } = require('../../src/stores/cartStore');
    const store = useCartStore.getState();

    store.addItem({
      menuItemId: '2',
      name: 'Tea',
      price: 500,
      quantity: 1,
      imageUrl: '',
      specDesc: '',
    });

    jest.advanceTimersByTime(1000);
    taroMock.setStorageSync.mockClear();

    store.clearCart();

    expect(taroMock.setStorageSync).toHaveBeenCalledTimes(1);
    expect(taroMock.setStorageSync).toHaveBeenCalledWith('taste_food_cart', {
      items: [],
      shopId: null,
      remarks: '',
    });
  });
});
