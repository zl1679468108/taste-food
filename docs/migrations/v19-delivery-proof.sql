-- v19: 骑手送达凭证（地理围栏 + 现场照片）
-- 扩展 tf_delivery_info，一单一条送达记录

ALTER TABLE "tf_delivery_info"
  ADD COLUMN IF NOT EXISTS "rider_id" text,
  ADD COLUMN IF NOT EXISTS "proof_photos" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "confirm_latitude" numeric(10, 7),
  ADD COLUMN IF NOT EXISTS "confirm_longitude" numeric(10, 7),
  ADD COLUMN IF NOT EXISTS "confirm_accuracy" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "confirm_distance_m" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "confirm_radius_m" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "confirm_source" text DEFAULT 'rider';

-- 一单一条送达信息
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tf_delivery_info_order_id_key'
  ) THEN
    -- 先清理可能的重复，保留最新
    DELETE FROM tf_delivery_info a
    USING tf_delivery_info b
    WHERE a.order_id = b.order_id
      AND a.ctid < b.ctid;
    ALTER TABLE tf_delivery_info ADD CONSTRAINT tf_delivery_info_order_id_key UNIQUE (order_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_info_rider_id ON tf_delivery_info(rider_id);
