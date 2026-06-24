import dayjs from 'dayjs';

export const formatPrice = (price: number): string => {
  return `¥${(price / 100).toFixed(2)}`;
};

export const formatTime = (time: string, format = 'YYYY-MM-DD HH:mm'): string => {
  return dayjs(time).format(format);
};

export const shortOrderId = (id: string): string => {
  return id.substring(0, 8).toUpperCase();
};