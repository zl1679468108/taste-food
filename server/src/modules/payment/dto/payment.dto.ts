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
}
