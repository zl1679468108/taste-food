import { formatPrice, formatPriceWithSymbol, formatTime, shortOrderId } from '../src/utils/format';

describe('format 工具函数', () => {
  describe('formatPrice', () => {
    test('分转元 - 整数', () => {
      expect(formatPrice(100)).toBe('1.00');
      expect(formatPrice(500)).toBe('5.00');
      expect(formatPrice(1880)).toBe('18.80');
    });

    test('分转元 - 小数', () => {
      expect(formatPrice(199)).toBe('1.99');
      expect(formatPrice(1)).toBe('0.01');
      expect(formatPrice(0)).toBe('0.00');
    });
  });

  describe('formatPriceWithSymbol', () => {
    test('添加¥符号', () => {
      expect(formatPriceWithSymbol(100)).toBe('¥1.00');
      expect(formatPriceWithSymbol(500)).toBe('¥5.00');
      expect(formatPriceWithSymbol(0)).toBe('¥0.00');
    });
  });

  describe('formatTime', () => {
    test('格式化时间字符串', () => {
      const result = formatTime('2026-06-25T10:30:00Z');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    test('自定义格式', () => {
      const result = formatTime('2026-06-25T10:30:00Z', 'MM-DD HH:mm');
      expect(result).toMatch(/\d{2}-\d{2} \d{2}:\d{2}/);
    });
  });

  describe('shortOrderId', () => {
    test('截取前8位并大写', () => {
      expect(shortOrderId('abc12345-6789')).toBe('#ABC12345');
      expect(shortOrderId('12345678')).toBe('#12345678');
    });
  });
});
