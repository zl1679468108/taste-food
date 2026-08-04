import request from '@/utils/request';

/** 商家 → 顾客 站内信（§3.25 / T314） */
export interface ShopMessage {
  id: string;
  shopId: string;
  fromUserId: string;
  toUserId: string;
  /** 收件顾客昵称（冗余存储，便于后台展示） */
  toUserNick?: string;
  content: string;
  /** 已读时间；空串表示未读 */
  readAt?: string;
  createdAt: string;
}

export interface GetShopMessagesParams {
  toUserId?: string;
  page?: number;
  pageSize?: number;
}

/** 发送站内信（商家 → 顾客） */
export const sendShopMessage = (toUserId: string, content: string) =>
  request.post(`/api/merchant/messages/customers/${toUserId}`, { content }) as Promise<ShopMessage>;

/** 商家发件箱（可按顾客过滤） */
export const getShopMessages = (params: GetShopMessagesParams) =>
  request.get('/api/merchant/messages', { params }) as Promise<{
    items: ShopMessage[];
    total: number;
  }>;
