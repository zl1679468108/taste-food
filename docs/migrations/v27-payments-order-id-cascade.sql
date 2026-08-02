-- ============================================================
-- T181 衍生漂移修正：tf_payments.order_id 外键动作对齐规范
-- ------------------------------------------------------------
-- 规范 database-init.sql 定义：
--   "order_id" uuid REFERENCES tf_orders(id) ON DELETE CASCADE
-- 但线上存量库实际为 ON DELETE RESTRICT（删除测试单时曾因此报 FK 冲突）。
-- 本迁移将线上对齐到规范（CASCADE），保持三位一体同步。
--
-- ⚠️ 语义风险提示（执行前请确认）：
--   CASCADE 意味着「删除订单」会级联删除其支付记录（tf_payments）。
--   若你更倾向保留 RESTRICT 安全网（防止误删订单连累财务记录），
--   请勿执行本文件，而应将 database-init.sql 的 ON DELETE 改为 RESTRICT。
--   二选一，二者皆可，但规范与线上必须一致。
-- ============================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tf_payments_order_id_fkey'
  ) THEN
    ALTER TABLE "tf_payments"
      DROP CONSTRAINT "tf_payments_order_id_fkey";
    ALTER TABLE "tf_payments"
      ADD CONSTRAINT "tf_payments_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "tf_orders"("id") ON DELETE CASCADE;
  END IF;
END $$;
