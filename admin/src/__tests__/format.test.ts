import { formatPrice, formatTime, shortOrderId } from '../utils/format';

describe('format 工具函数', () => {
  describe('formatPrice', () => {
    it('将分转换为元并格式化', () => {
      expect(formatPrice(100)).toBe('¥1.00');
      expect(formatPrice(1500)).toBe('¥15.00');
      expect(formatPrice(0)).toBe('¥0.00');
    });

    it('处理小数', () => {
      expect(formatPrice(99)).toBe('¥0.99');
      expect(formatPrice(1999)).toBe('¥19.99');
    });
  });

  describe('formatTime', () => {
    it('格式化时间戳', () => {
      const time = '2026-06-25T10:30:00Z';
      const result = formatTime(time, 'YYYY-MM-DD HH:mm');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('使用默认格式', () => {
      const time = '2026-06-25T10:30:00Z';
      const result = formatTime(time);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });

  describe('shortOrderId', () => {
    it('截取前8位并大写', () => {
      const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(shortOrderId(id)).toBe('A1B2C3D4');
    });

    it('处理短ID', () => {
      const id = 'abc123';
      expect(shortOrderId(id)).toBe('ABC123');
    });
  });
});