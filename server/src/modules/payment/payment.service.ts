import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus } from '../../common/constants/enums';
import { OrderService, OrderRecord } from '../order/order.service';
import { PaymentResponseDto } from './dto/payment.dto';

interface PaymentRecord {
  transactionId: string;
  orderId: string;
  userId: string;
  amount: number;
  status: 'success' | 'failed';
  paidAt: string;
}

@Injectable()
export class PaymentService {
  private payments: Map<string, PaymentRecord> = new Map();

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

    // 模拟支付处理
    const now = new Date().toISOString();
    const transactionId = uuidv4();

    const payment: PaymentRecord = {
      transactionId,
      orderId,
      userId,
      amount: order.total,
      status: 'success',
      paidAt: now,
    };

    this.payments.set(transactionId, payment);

    // 更新订单状态为已支付
    await this.orderService.updateStatus(orderId, {
      status: OrderStatus.PAID,
    });

    return {
      transactionId,
      orderId,
      amount: order.total,
      status: 'success',
      paidAt: now,
    };
  }

  async getPaymentByOrderId(orderId: string): Promise<PaymentResponseDto | null> {
    for (const payment of this.payments.values()) {
      if (payment.orderId === orderId) {
        return {
          transactionId: payment.transactionId,
          orderId: payment.orderId,
          amount: payment.amount,
          status: payment.status,
          paidAt: payment.paidAt,
        };
      }
    }
    return null;
  }
}
