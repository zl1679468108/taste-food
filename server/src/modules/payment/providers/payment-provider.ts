/**
 * 支付渠道抽象层
 *
 * - sandbox: 开发/演示沙箱支付（个人主体默认可走此通道）
 * - wechat: 官方微信支付（需企业商户号 + 小程序支付权限）
 * - third_party: 第三方聚合支付预留（虎皮椒/PayJS 等，非免费且合规风险高）
 *
 * 个人主体 AppID 无法开通官方微信支付 JSAPI。
 * 推荐路径：sandbox 联调 → 企业资质后切 wechat。
 */
export type PaymentProviderName = 'sandbox' | 'wechat' | 'third_party';

export interface SandboxPayResult {
  provider: 'sandbox';
  mock: true;
  transactionId: string;
  status: 'success';
  paidAt: string;
}

export interface WechatPayResult {
  provider: 'wechat';
  mock: false;
  transactionId: string;
  status: 'pending';
  paidAt?: string;
  wxPayParams: {
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: 'MD5' | 'HMAC-SHA256' | 'RSA';
    paySign: string;
  };
}

export type ProviderPayResult = SandboxPayResult | WechatPayResult;

export function resolvePaymentProvider(): PaymentProviderName {
  const configured = (process.env.PAYMENT_PROVIDER || '').toLowerCase() as PaymentProviderName | '';
  if (configured === 'sandbox' || configured === 'wechat' || configured === 'third_party') {
    return configured;
  }
  // 未显式配置时：开发默认 sandbox；生产若允许沙箱（个人主体演示）则 sandbox，否则 wechat
  if (process.env.NODE_ENV !== 'production') {
    return 'sandbox';
  }
  return isSandboxPaymentAllowed() ? 'sandbox' : 'wechat';
}

export function isSandboxPaymentAllowed(): boolean {
  if (process.env.ALLOW_SANDBOX_PAYMENT === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}
