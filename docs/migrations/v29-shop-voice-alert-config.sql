-- v29: 店铺语音播报配置列（T308）
-- 语音播报话术选择 + 总开关/音量/重复次数持久化到店铺维度，跨设备/换浏览器不丢失。
-- 与 docs/database-init.sql 的 tf_shops.voice_alert_config 对齐。

ALTER TABLE "tf_shops" ADD COLUMN IF NOT EXISTS "voice_alert_config" jsonb DEFAULT NULL;

-- 注释（可选，便于排查）：配置结构
-- {
--   "selection": { "order_paid": "order_paid_1", "order_cancel_request": "...", ... }, -- 每状态选中的话术 id
--   "enabled": true,        -- 总开关
--   "volume": 1,            -- 0~1 播放音量
--   "repeat": 1             -- 1~3 同一事件重复播报次数
-- }

COMMENT ON COLUMN "tf_shops"."voice_alert_config" IS '语音播报配置（T308）：selection 话术选择 / enabled 总开关 / volume 音量 / repeat 重复次数';
