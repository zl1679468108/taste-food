-- v23: 补齐线上库漂移缺列（T181.1 + T181.2）
-- 只读核查（2026-08-01）发现线上 Supabase 在旧版 init 脚本之上缺以下三列：
--   T181.1  tf_payments.updated_at   → order.service.ts markPaymentsRefunded 的 UPDATE 带 updated_at，
--                                       缺列导致 PGRST204 被 catch 静默吞掉，退款状态永不落库（引信已埋未触发）
--   T181.2  tf_orders.cancel_reason  → 写取消原因必失败，触发 minimal 降级，售后原因丢失
--   T181.2  tf_orders.reject_reason  → 同上，拒单原因丢失
--
-- 安全性：PG 11+ 带常量默认值的 ADD COLUMN 是 O(1) 元数据操作，不重写表、不加排他锁重写、无需停机。
--         全部 IF NOT EXISTS，可重复执行（幂等）。本文件只补列、不触碰已有数据。
--
-- 执行顺序依赖：v22 迁移（v22-payment-status-paid-refund-compat.sql）内含
--   `UPDATE tf_payments SET status='paid', updated_at=now() WHERE status='success';`
--   依赖 tf_payments.updated_at 存在，因此 v22 必须在【本文件之后】执行（线上 v22 此前从未跑过，见 T181.3）。

-- T181.1: 支付记录更新时间戳
ALTER TABLE "tf_payments"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now();

-- T181.2: 订单取消 / 拒单原因
ALTER TABLE "tf_orders"
  ADD COLUMN IF NOT EXISTS "cancel_reason" text,
  ADD COLUMN IF NOT EXISTS "reject_reason" text;
