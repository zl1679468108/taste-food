-- ============================================================
-- 迁移 v28：批量异步导出任务表（T267）
-- 记录后台导出任务的状态、参数与产物存储路径。
-- 配套导出中心（PC 管理后台 /export）使用。
-- 仅产出 Excel（xlsx），不走 CSV。
-- ============================================================

CREATE TABLE IF NOT EXISTS "tf_export_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL REFERENCES tf_shops(id) ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES tf_users(id) ON DELETE CASCADE,
  "entity" text NOT NULL DEFAULT 'orders',
  "status" text NOT NULL DEFAULT 'pending',
  "format" text NOT NULL DEFAULT 'xlsx',
  "params" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "file_path" text,
  "file_name" text,
  "row_count" int,
  "error_message" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "completed_at" timestamptz
);

ALTER TABLE "tf_export_jobs" DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_export_jobs_shop_created
  ON tf_export_jobs(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_user
  ON tf_export_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status
  ON tf_export_jobs(status);
