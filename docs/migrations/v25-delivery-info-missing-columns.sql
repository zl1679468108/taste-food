-- v25: 补齐 tf_delivery_info 结构分叉（T181.4）
-- 只读核查（2026-08-01）确认线上 tf_delivery_info 缺：shop_id / delivered_at / estimated_delivery_at / courier_name / courier_phone。
-- 另：线上多出 type 列（NOT NULL 无默认）→ 不带 type 的 INSERT 必失败，送达凭证走"仅内存保存"降级。
-- 修复：补 5 列 + 给 type 设默认 'delivery'（仅影响未来插入，不动存量数据）。
-- 全部 ADD COLUMN IF NOT EXISTS；ALTER COLUMN SET DEFAULT 幂等（重复执行无害）。
--
-- 注：type 是线上漂移多出的列，规范 schema(database-init.sql) 无此列；本迁移只保证线上可写入，
--     规范与代码的 type 语义对齐属另一议题，不在此文件范围。

ALTER TABLE "tf_delivery_info"
  ADD COLUMN IF NOT EXISTS "shop_id" uuid,
  ADD COLUMN IF NOT EXISTS "delivered_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "estimated_delivery_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "courier_name" text,
  ADD COLUMN IF NOT EXISTS "courier_phone" text;

-- 给线上多出的 NOT NULL 无默认 type 列补默认，解除 INSERT 失败
ALTER TABLE "tf_delivery_info" ALTER COLUMN "type" SET DEFAULT 'delivery';
