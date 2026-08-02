-- v20: 店铺送达围栏可配置 + 强制完成原因

ALTER TABLE "tf_shops"
  ADD COLUMN IF NOT EXISTS "delivery_confirm_radius_m" integer DEFAULT 500;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tf_shops_delivery_confirm_radius_m_check'
  ) THEN
    ALTER TABLE "tf_shops"
      ADD CONSTRAINT tf_shops_delivery_confirm_radius_m_check
      CHECK (
        delivery_confirm_radius_m IS NULL
        OR (delivery_confirm_radius_m >= 200 AND delivery_confirm_radius_m <= 1000)
      );
  END IF;
END $$;

UPDATE "tf_shops"
SET "delivery_confirm_radius_m" = 500
WHERE "delivery_confirm_radius_m" IS NULL;

ALTER TABLE "tf_delivery_info"
  ADD COLUMN IF NOT EXISTS "force_reason" text;
