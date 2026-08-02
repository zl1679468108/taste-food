-- v26: 三处 shop_id 补外键（T181.6）
-- 只读核查（2026-08-01）确认：tf_order_items / tf_payments / tf_users 的 shop_id 去重值均只有 1 个，
--   且全部存在于 tf_shops → 孤儿行 = 0，可安全加 FK。
-- 成因：历史脚本用 ADD COLUMN IF NOT EXISTS 补列不带 FK，存量库永远建不出。
-- 仅加 FK（不加 NOT NULL），避免存量 NULL 行阻断；语义对齐规范
--   （order_items / payments → ON DELETE RESTRICT，users → ON DELETE SET NULL）。
-- 每条用 DO 块幂等（ADD CONSTRAINT 本身不支持 IF NOT EXISTS）。

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tf_order_items_shop_id_fkey') THEN
    ALTER TABLE "tf_order_items"
      ADD CONSTRAINT "tf_order_items_shop_id_fkey"
      FOREIGN KEY ("shop_id") REFERENCES "tf_shops"("id") ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tf_payments_shop_id_fkey') THEN
    ALTER TABLE "tf_payments"
      ADD CONSTRAINT "tf_payments_shop_id_fkey"
      FOREIGN KEY ("shop_id") REFERENCES "tf_shops"("id") ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tf_users_shop_id_fkey') THEN
    ALTER TABLE "tf_users"
      ADD CONSTRAINT "tf_users_shop_id_fkey"
      FOREIGN KEY ("shop_id") REFERENCES "tf_shops"("id") ON DELETE SET NULL;
  END IF;
END $$;
