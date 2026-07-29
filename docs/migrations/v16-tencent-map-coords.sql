-- v16 腾讯地图坐标对齐（T211）
-- GCJ-02：与微信小程序 map / chooseLocation 一致

ALTER TABLE "tf_shops" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);
ALTER TABLE "tf_shops" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);

ALTER TABLE "tf_addresses" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);
ALTER TABLE "tf_addresses" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);

ALTER TABLE "tf_orders" ADD COLUMN IF NOT EXISTS "shop_latitude" numeric(10, 7);
ALTER TABLE "tf_orders" ADD COLUMN IF NOT EXISTS "shop_longitude" numeric(10, 7);
ALTER TABLE "tf_orders" ADD COLUMN IF NOT EXISTS "delivery_latitude" numeric(10, 7);
ALTER TABLE "tf_orders" ADD COLUMN IF NOT EXISTS "delivery_longitude" numeric(10, 7);

-- 若 API 报 Could not find the 'latitude' column ... in the schema cache：
-- 列可能已存在，仅 PostgREST schema cache 未刷新。执行：
NOTIFY pgrst, 'reload schema';
