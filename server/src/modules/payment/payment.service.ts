import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus, UserRole } from '../../common/constants/enums';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { OrderService, OrderRecord } from '../order/order.service';
import { PaymentResponseDto } from './dto/payment.dto';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';

// Memory fallback
const memoryPayments: Map<string, PaymentResponseDto> = new Map();

const isProduction = process.env.NODE_ENV === 'production';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly orderService: OrderService) {}

  private assertCanAccessPayment(order: OrderRecord, user: CurrentUserPayload): void {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.CUSTOMER && order.userId === user.userId) return;
    if (user.role === UserRole.RIDER && order.riderId === user.userId) return;
    throw new ForbiddenException('无权查看该订单支付信息');
  }

  /**
   * 模拟支付接口。
   * 生产环境强制关闭此接口，必须接入真实微信支付（见 T43）。
   * 开发环境下调用即标记为支付成功，响应中明确标注 mock: true。
   */
  async payOrder(
    orderId: string,
    userId: string,
  ): Promise<PaymentResponseDto> {
    // 生产环境禁止使用模拟支付，必须接入真实微信支付
    if (isProduction) {
      throw new BadRequestException(
        '生产环境不支持模拟支付，请接入真实微信支付（参考 T43）',
      );
    }

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
      mock: true, // 明确标注为模拟支付
    };

    if (hasSupabase() && supabase) {
      // 使用原子 RPC 一次完成：权限校验 + 状态校验 + 支付记录插入 + 订单状态更新 + daily_stats 联动
      const { error: rpcErr } = await supabase.rpc('atomic_pay_order', {
        p_order_id: orderId,
        p_user_id: userId,
        p_amount: order.total,
        p_transaction_id: transactionId,
      });
      if (rpcErr) {
        // RPC 失败可能是约束冲突（如重复支付）或订单状态变化，回退到内存仅用于开发环境
        assertMemoryFallbackAllowed('PaymentService');
        this.logger.warn(`原子支付 RPC 失败，回退到内存: ${rpcErr.message}`);
        memoryPayments.set(transactionId, payment);
        // 仍需更新订单状态
        await this.orderService.updateStatus(orderId, { status: OrderStatus.PAID });
      }
    } else {
      assertMemoryFallbackAllowed('PaymentService');
      memoryPayments.set(transactionId, payment);
      // 内存模式：直接更新订单状态（内存模式无 daily_stats）
      await this.orderService.updateStatus(orderId, { status: OrderStatus.PAID });
    }

    return payment;
  }

  async getPaymentByOrderId(
    orderId: string,
    user: CurrentUserPayload,
  ): Promise<PaymentResponseDto | null> {
    const order = await this.orderService.findById(orderId);
    this.assertCanAccessPayment(order, user);

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

    assertMemoryFallbackAllowed('PaymentService');
    for (const payment of memoryPayments.values()) {
      if (payment.orderId === orderId) return payment;
    }
    return null;
  }
}
