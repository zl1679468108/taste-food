import { IsString, IsOptional } from 'class-validator';

export class PayOrderDto {
  @IsString()
  orderId!: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;
}

/**
 * 微信小程序支付参数（Taro.requestPayment 需要）
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
  /** 是否沙箱/模拟支付 */
  mock?: boolean;
  /** 支付渠道：sandbox | wechat | third_party */
  provider?: 'sandbox' | 'wechat' | 'third_party';
  /** 真实微信支付参数：存在时前端调起 Taro.requestPayment */
  wxPayParams?: WxPayParams;
}
