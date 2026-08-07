-- ============================================================
-- v34: 订单状态数量聚合查询性能优化
-- 目标: 支撑 count_orders_by_scope RPC（在 GET /api/orders 内嵌调用，
--       用于给 data.counts 填充各状态聚合），避免前端多次按状态查列表
--       时触发全表扫描。
-- 日期: 2026-08-04
-- 幂等: CREATE INDEX IF NOT EXISTS / CREATE OR REPLACE FUNCTION，可重跑
-- ============================================================

-- ============================================================
-- 1) 为 count_orders_by_scope 与各角色列表加复合索引
-- ============================================================

-- 商家/平台按店+状态聚合：count_orders_by_scope('shop') 的主路径
CREATE INDEX IF NOT EXISTS idx_orders_shop_status
  ON tf_orders(shop_id, status);

-- 按状态查商家订单（兼容旧链路、列表筛选、抢单池子查询）
CREATE INDEX IF NOT EXISTS idx_orders_status_shop
  ON tf_orders(status, shop_id);

-- 顾客端按用户+状态聚合/筛选
CREATE INDEX IF NOT EXISTS idx_orders_user_status
  ON tf_orders(user_id, status);

-- 骑手端按骑手+状态聚合/筛选
CREATE INDEX IF NOT EXISTS idx_orders_rider_status
  ON tf_orders(rider_id, status);

-- 抢单池/骑手负载：delivery_type + rider_id + status 组合
CREATE INDEX IF NOT EXISTS idx_orders_delivery_pool
  ON tf_orders(delivery_type, rider_id, status)
  WHERE delivery_type = 'delivery' AND rider_id IS NULL;

-- ============================================================
-- 2) 刷新统计信息，让优化器能识别新索引
-- ============================================================

ANALYZE tf_orders;

-- ============================================================
-- 验证（务必全选整段 migration 后再 Run；末尾仅用于手工验证）
-- ============================================================
-- 1) 确认索引存在：
--    SELECT indexname, indexdef
--      FROM pg_indexes
--     WHERE tablename = 'tf_orders'
--       AND indexname IN (
--         'idx_orders_shop_status',
--         'idx_orders_status_shop',
--         'idx_orders_user_status',
--         'idx_orders_rider_status',
--         'idx_orders_delivery_pool'
--       );
--
-- 2) 调用聚合函数（用 ::uuid 显式 cast）：
--    SELECT * FROM count_orders_by_scope('shop', '00000000-0000-0000-0000-000000000001'::text, NULL);
