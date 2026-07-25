import request from '@/utils/request';

export interface ShopTable {
  id: string;
  shopId: string;
  tableNo: string;
  label?: string;
  sortOrder: number;
  active: boolean;
  scanPath: string;
  createdAt: string;
}

export const listTables = (shopId: string) =>
  request.get(`/api/shops/${shopId}/tables/manage`) as Promise<ShopTable[]>;

export const createTable = (
  shopId: string,
  data: { tableNo: string; label?: string; sortOrder?: number; active?: boolean },
) => request.post(`/api/shops/${shopId}/tables`, data) as Promise<ShopTable>;

export const updateTable = (
  shopId: string,
  tableId: string,
  data: Partial<{ tableNo: string; label: string; sortOrder: number; active: boolean }>,
) => request.patch(`/api/shops/${shopId}/tables/${tableId}`, data) as Promise<ShopTable>;

export const deleteTable = (shopId: string, tableId: string) =>
  request.delete(`/api/shops/${shopId}/tables/${tableId}`);

export const seedTables = (shopId: string) =>
  request.post(`/api/shops/${shopId}/tables/seed`) as Promise<ShopTable[]>;

/** 普通二维码图片（打印辅助）。正式环境请用微信小程序码。 */
export function buildTableQrImageUrl(scanPath: string, size = 220) {
  const data = encodeURIComponent(scanPath);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
}
