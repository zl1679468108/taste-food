import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class PayOrderDto {
  @IsString()
  orderId!: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;
}

export class PaymentResponseDto {
  transactionId!: string;
  orderId!: string;
  amount!: number;
  status!: string;
  paidAt!: string;
  // 标注是否为模拟支付，真实微信支付时为 false 或不存在
  mock?: boolean;
}
