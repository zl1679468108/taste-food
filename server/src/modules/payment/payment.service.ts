import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus } from '../../common/constants/enums';
import { OrderService, OrderRecord } from '../order/order.service';
import { PaymentResponseDto } from './dto/payment.dto';
import { supabase, hasSupabase } from '../../database/supabase.client';

// Memory fallback
const memoryPayments: Map<string, PaymentResponseDto> = new Map();

@Injectable()
export class PaymentService {
  constructor(private readonly orderService: OrderService) {}

  async payOrder(
    orderId: string,
    userId: string,
  ): Promise<PaymentResponseDto> {
    const order: OrderRecord = await this.orderService.findById(orderId);

    if (order.userId !== userId) {
      throw new BadRequestException('不能支付他人的订单');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `订单状态为 ${order.status}，不允许支付`,
      );
    }

    const now = new Date().toISOString();
    const transactionId = uuidv4();

    const payment: PaymentResponseDto = {
      transactionId,
      orderId,
      amount: order.total,
      status: 'success',
      paidAt: now,
    };

    if (hasSupabase() && supabase) {
      const { error } = await supabase
        .from('tf_payments')
        .insert({
          id: transactionId,
          order_id: orderId,
          user_id: userId,
          amount: order.total,
          status: 'success',
          paid_at: now,
        });
      if (error) {
        // Table might not exist, fall back to memory
        memoryPayments.set(transactionId, payment);
      }
    } else {
      memoryPayments.set(transactionId, payment);
    }

    // Update order status to paid
    await this.orderService.updateStatus(orderId, {
      status: OrderStatus.PAID,
    });

    // Atomically update daily stats after payment confirmation
    try {
      const orderDate = new Date().toISOString().split('T')[0];
      const { error: statsErr } = await supabase!.rpc('atomic_update_daily_stats', {
        p_shop_id: order.shopId,
        p_stat_date: orderDate,
        p_order_delta: 1,
        p_revenue_delta: order.total,
        p_completed_delta: 0,
        p_cancelled_delta: 0,
      });
      if (statsErr) {
        console.warn('日统计更新失败:', statsErr.message);
      }
    } catch (e) {
      console.warn('支付后统计更新异常:', e instanceof Error ? e.message : e);
    }

    return payment;
  }

  async getPaymentByOrderId(orderId: string): Promise<PaymentResponseDto | null> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_payments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error || !data) return null;
      return {
        transactionId: data.id,
        orderId: data.order_id,
        amount: data.amount,
        status: data.status,
        paidAt: data.paid_at,
      };
    }

    for (const payment of memoryPayments.values()) {
      if (payment.orderId === orderId) return payment;
    }
    return null;
  }
}
