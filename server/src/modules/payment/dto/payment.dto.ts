import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class PayOrderDto {
  @IsString()
  orderId!: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;
}

/**
 * 微信小程序支付参数（uni.requestPayment / Taro.requestPayment 需要）
 * 后端调用微信统一下单 API 后返回，前端透传给 requestPayment
 */
export interface WxPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string; // prepay_id=xxx
  signType: 'MD5' | 'HMAC-SHA256' | 'RSA';
  paySign: string;
}

export class PaymentResponseDto {
  transactionId!: string;
  orderId!: string;
  amount!: number;
  status!: string;
  paidAt!: string;
  // 标注是否为模拟支付，真实微信支付时为 false 或不存在
  mock?: boolean;
  // 真实微信支付参数：存在时前端需调起 Taro.requestPayment
  // 仅当生产环境接入真实微信支付后返回
  wxPayParams?: WxPayParams;
}
