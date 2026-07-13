import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '../../common/constants/enums';
import { supabase, hasSupabase } from '../../database/supabase.client';

export interface SubscriptionMessagePayload {
  userId: string;
  templateId: string;
  page: string;
  data: Record<string, { value: string }>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * 根据 userId(uuid) 查询用户 openid
   * 微信订阅消息的 touser 字段必须是 openid，不能用 userId
   */
  private async resolveOpenId(userId: string): Promise<string | null> {
    if (!hasSupabase() || !supabase) {
      this.logger.warn('[Notification] Supabase 不可用，无法查询 openid');
      return null;
    }
    const { data, error } = await supabase
      .from('tf_users')
      .select('openid')
      .eq('id', userId)
      .single();
    if (error || !data) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[Notification] 查询用户 openid 失败: userId=${userId} err=${errMsg}`);
      return null;
    }
    return data.openid;
  }

  /**
   * 发送微信订阅消息
   * 注意：个人主体 AppID 无法调用微信订阅消息 API
   * 此服务为预留接口，企业主体认证后配置 WECHAT_APP_ID / WECHAT_APP_SECRET / WECHAT_TEMPLATE_IDS 即可启用
   */
  async sendSubscriptionMessage(payload: SubscriptionMessagePayload): Promise<boolean> {
    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!appId || !appSecret) {
      this.logger.warn('[Notification] 微信订阅消息未配置（WECHAT_APP_ID/WECHAT_APP_SECRET），跳过发送');
      return false;
    }

    try {
      // 1. 获取 access_token
      const tokenRes = await fetch(
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`,
      );
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        this.logger.error('[Notification] 获取 access_token 失败:', tokenData);
        return false;
      }

      // 2. 根据 userId 查询 openid（微信订阅消息 touser 必须是 openid）
      const openId = await this.resolveOpenId(payload.userId);
      if (!openId) {
        this.logger.warn(`[Notification] 无法解析 openid，跳过发送: userId=${payload.userId}`);
        return false;
      }

      // 3. 发送订阅消息
      const msgRes = await fetch(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${tokenData.access_token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            touser: openId,
            template_id: payload.templateId,
            page: payload.page,
            data: payload.data,
          }),
        },
      );

      const msgData = await msgRes.json();
      if (msgData.errcode !== 0) {
        this.logger.error('[Notification] 发送订阅消息失败:', msgData);
        return false;
      }

      this.logger.log(`[Notification] 订阅消息发送成功: openId=${openId}, template=${payload.templateId}`);
      return true;
    } catch (error) {
      this.logger.error('[Notification] 发送订阅消息异常:', error);
      return false;
    }
  }

  /**
   * 订单状态变更通知
   */
  async notifyOrderStatusChange(
    userId: string,
    orderId: string,
    status: OrderStatus,
    previousStatus: OrderStatus,
  ): Promise<boolean> {
    const statusText: Record<OrderStatus, string> = {
      [OrderStatus.PENDING_PAYMENT]: '待支付',
      [OrderStatus.PAID]: '已支付',
      [OrderStatus.ACCEPTED]: '已接单',
      [OrderStatus.PREPARING]: '制作中',
      [OrderStatus.READY_FOR_PICKUP]: '待取餐',
      [OrderStatus.DELIVERING]: '配送中',
      [OrderStatus.COMPLETED]: '已完成',
      [OrderStatus.CANCELLED]: '已取消',
      [OrderStatus.REJECTED]: '已拒绝',
    };

    const templateId = process.env.WECHAT_TEMPLATE_ORDER_STATUS;
    if (!templateId) {
      this.logger.debug('[Notification] 未配置订单状态变更模板 ID，跳过通知');
      return false;
    }

    return this.sendSubscriptionMessage({
      userId,
      templateId,
      page: `/pages/order-detail/index?id=${orderId}`,
      data: {
        thing1: { value: statusText[previousStatus] || previousStatus },
        thing2: { value: statusText[status] || status },
        time3: { value: new Date().toLocaleString('zh-CN') },
        thing4: { value: orderId.substring(0, 12) + '...' },
      },
    });
  }

  /**
   * 新订单通知（发给商家）
   */
  async notifyNewOrder(
    adminUserId: string,
    orderId: string,
    total: number,
  ): Promise<boolean> {
    const templateId = process.env.WECHAT_TEMPLATE_NEW_ORDER;
    if (!templateId) {
      this.logger.debug('[Notification] 未配置新订单模板 ID，跳过通知');
      return false;
    }

    return this.sendSubscriptionMessage({
      userId: adminUserId,
      templateId,
      page: `/pages/admin/index`,
      data: {
        thing1: { value: `订单 ${orderId.substring(0, 12)}...` },
        amount2: { value: `¥${(total / 100).toFixed(2)}` },
        time3: { value: new Date().toLocaleString('zh-CN') },
      },
    });
  }
}
