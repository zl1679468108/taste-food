-- v24: 补齐 tf_users 缺失列（T181.5）
-- 只读核查（2026-08-01）确认线上 tf_users 缺 last_login_at / updated_at：
--   auth.service.ts:288 updateLastLoginAt 整体失效（吞异常），后台"最后登录"永远为空。
-- PG 11+ 带常量默认值的 ADD COLUMN 为 O(1) 元数据操作，不重写表、不停机。
-- 全部 IF NOT EXISTS，可重复执行（幂等）。规范 schema(database-init.sql) 已含这两列，本文件只桥接线上漂移。

ALTER TABLE "tf_users"
  ADD COLUMN IF NOT EXISTS "last_login_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now();
