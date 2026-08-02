import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderService, OrderRecord } from '../order/order.service';
import { OrderStatus, UserRole } from '../../common/constants/enums';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PaymentResponseDto } from './dto/payment.dto';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import {
  isSandboxPaymentAllowed,
  resolvePaymentProvider,
} from './providers/payment-provider';

// Memory fallback
const memoryPayments: Map<string, PaymentResponseDto> = new Map();

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
   * 支付入口：按 PAYMENT_PROVIDER 分流
   * - sandbox: 开发/演示沙箱，立即成功（mock:true）
   * - wechat: 官方微信支付（需商户配置，未配置时明确报错）
   * - third_party: 预留，暂未实现
   */
  async payOrder(
    orderId: string,
    userId: string,
  ): Promise<PaymentResponseDto> {
    const provider = resolvePaymentProvider();

    if (provider === 'sandbox') {
      return this.payWithSandbox(orderId, userId);
    }

    if (provider === 'third_party') {
      throw new ServiceUnavailableException(
        '第三方聚合支付尚未接入。个人主体请使用 PAYMENT_PROVIDER=sandbox；企业资质后建议使用官方微信支付。',
      );
    }

    // wechat
    return this.payWithWechat(orderId, userId);
  }

  /** 沙箱支付：立即标记成功，明确 mock/provider 字段 */
  private async payWithSandbox(
    orderId: string,
    userId: string,
  ): Promise<PaymentResponseDto> {
    if (!isSandboxPaymentAllowed()) {
      throw new BadRequestException(
        '当前环境禁止沙箱支付。开发环境默认可用；演示环境可设 ALLOW_SANDBOX_PAYMENT=true；生产请接入 wechat。',
      );
    }

    const order: OrderRecord = await this.orderService.findById(orderId);
    this.assertOrderPayable(order, userId);

    const now = new Date().toISOString();
    const transactionId = uuidv4();

    const payment: PaymentResponseDto = {
      transactionId,
      orderId,
      amount: order.total,
      status: 'paid',
      paidAt: now,
      mock: true,
      provider: 'sandbox',
    };

    await this.persistSuccessfulPayment(orderId, userId, order.total, transactionId, payment);
    this.logger.log(`[sandbox] 订单 ${orderId} 支付成功 amount=${order.total}`);
    return payment;
  }

  /**
   * 官方微信支付占位：配置齐全前返回明确错误，避免静默 mock。
   * 后续接入统一下单后返回 wxPayParams。
   */
  private async payWithWechat(
    orderId: string,
    userId: string,
  ): Promise<PaymentResponseDto> {
    const mchId = process.env.WECHAT_MCH_ID;
    const apiKey = process.env.WECHAT_PAY_API_KEY || process.env.WECHAT_MCH_API_V3_KEY;
    const appId = process.env.WECHAT_APP_ID;

    if (!mchId || !apiKey || !appId) {
      throw new ServiceUnavailableException(
        '微信支付未配置（需要 WECHAT_APP_ID / WECHAT_MCH_ID / WECHAT_PAY_API_KEY）。个人主体请使用 PAYMENT_PROVIDER=sandbox。',
      );
    }

    // 预留：调用微信统一下单 API 后返回 wxPayParams
    // 当前已具备订单校验与响应结构，待企业商户凭证到位后补齐签名逻辑（T43）
    const order: OrderRecord = await this.orderService.findById(orderId);
    this.assertOrderPayable(order, userId);

    throw new ServiceUnavailableException(
      '微信支付商户配置已识别，统一下单签名逻辑待 T43 完成。开发联调请设 PAYMENT_PROVIDER=sandbox。',
    );
  }

  private assertOrderPayable(order: OrderRecord, userId: string): void {
    if (order.userId !== userId) {
      throw new BadRequestException('不能支付他人的订单');
    }
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException(`订单状态为 ${order.status}，不允许支付`);
    }
  }

  private isMissingRpcError(error: { message?: string; code?: string } | null | undefined): boolean {
    const msg = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return (
      msg.includes('could not find the function') ||
      (msg.includes('function') && msg.includes('schema cache')) ||
      msg.includes('pgrst202') ||
      code === 'pgrst202' ||
      code === '42883'
    );
  }

  private async insertPaymentRecord(
    orderId: string,
    userId: string,
    amount: number,
    transactionId: string,
    payment: PaymentResponseDto,
  ): Promise<void> {
    if (!supabase) return;
    const now = payment.paidAt || new Date().toISOString();
    // T181 后 tf_payments 列已齐全；库用 method 列且 CHECK 仅允许 wechat/alipay/balance，
    // 而 payment.provider 不存在于库，多候选降级为历史 provider/method 错位兼容死代码，已废弃。
    // 直写有效列，method 省略走默认 'wechat'，并保留 user_id / paid_at（旧候选 2 会丢失二者）。
    const { error } = await supabase.from('tf_payments').insert({
      id: transactionId,
      order_id: orderId,
      user_id: userId,
      amount,
      status: payment.status || 'paid',
      paid_at: now,
      created_at: now,
    });
    if (error) {
      this.logger.warn(`[Payment] 写入 tf_payments 失败，继续更新订单状态: ${error.message}`);
    }
  }

  private async persistSuccessfulPayment(
    orderId: string,
    userId: string,
    amount: number,
    transactionId: string,
    payment: PaymentResponseDto,
  ): Promise<void> {
    if (hasSupabase() && supabase) {
      const { error: rpcErr } = await supabase.rpc('atomic_pay_order', {
        p_order_id: orderId,
        p_user_id: userId,
        p_amount: amount,
        p_transaction_id: transactionId,
      });
      if (rpcErr) {
        if (this.isMissingRpcError(rpcErr)) {
          this.logger.warn(
            `原子支付 RPC 不可用，降级直写支付记录 + 更新订单状态: ${rpcErr.message}`,
          );
          await this.insertPaymentRecord(orderId, userId, amount, transactionId, payment);
          // updateStatus 内部 emitStatusEvents → order:updated + order:new/paid
          await this.orderService.updateStatus(orderId, { status: OrderStatus.PAID });
          return;
        }

        // 非 RPC 缺失错误：尝试仍更新订单状态，避免支付成功后订单卡在 pending
        this.logger.warn(`原子支付 RPC 失败，尝试直更订单状态: ${rpcErr.message}`);
        await this.insertPaymentRecord(orderId, userId, amount, transactionId, payment);
        await this.orderService.updateStatus(orderId, { status: OrderStatus.PAID });
        return;
      }
      // RPC 成功时状态已在库内更新，必须显式 notifyPaid 推送商家新订单
      await this.orderService.notifyPaid(orderId, OrderStatus.PENDING_PAYMENT);
      return;
    }

    assertMemoryFallbackAllowed('PaymentService');
    memoryPayments.set(transactionId, payment);
    // 内存路径：updateStatus 等价于 notifyPaid（会 emit order:new/paid）
    await this.orderService.updateStatus(orderId, { status: OrderStatus.PAID });
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
        provider: data.provider || undefined,
      };
    }

    assertMemoryFallbackAllowed('PaymentService');
    for (const payment of memoryPayments.values()) {
      if (payment.orderId === orderId) return payment;
    }
    return null;
  }
}
