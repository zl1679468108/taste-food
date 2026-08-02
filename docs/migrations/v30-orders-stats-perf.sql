-- v30: Dashboard 统计查询性能优化（T30x）
-- 背景：
--   PC 管理后台 Dashboard 的 `GET /api/orders/stats/today` 与
--   `GET /api/orders/stats/daily` 在 Supabase 跨区网络下接近 10s 超时，
--   触发 axios timeout → 前端弹 "统计数据加载失败，请稍后重试"。
--   根因：现有 `idx_orders_shop_id` 单独索引无法覆盖
--         `WHERE shop_id = ? AND created_at >= ?` 的范围扫描，
--         Node 端还会把全量订单行加载到内存再 JS 聚合。
--
-- 方案：
--   1) 加复合索引 `(shop_id, created_at)`，覆盖「按店 + 时间范围」的主路径
--   2) 加复合索引 `(shop_id, status, created_at)`，覆盖 today 端
--      「按店 + 状态 + 时间」聚合的次路径
--   3) 引入 `get_today_stats(p_shop_id)` / `get_daily_stats(p_shop_id, p_start_date, p_end_date)`
--      两个 SECURITY DEFINER RPC，在 PostgreSQL 端用 COUNT FILTER + SUM FILTER 一次返回，
--      不再把订单行加载到 Node。
--   4) `get_today_stats` 兼容老的 `tf_daily_stats` 预聚合表（total_orders/completed_orders 仍用预聚合值），
--      其余指标在 orders 上 COUNT FILTER 计算。
--
-- 兼容性：
--   - 索引 CREATE INDEX IF NOT EXISTS，可重复跑
--   - RPC CREATE OR REPLACE FUNCTION，可重复跑
--   - 后端 order.service.ts 优先调用 RPC；RPC 缺失时回退原 SELECT 逻辑（防御性）

-- ============================================================
-- 1) 复合索引
-- ============================================================

-- 覆盖「按店 + 时间范围」主路径（stats/daily、订单列表、today 的 created_at 过滤）
CREATE INDEX IF NOT EXISTS idx_orders_shop_created_at
  ON tf_orders(shop_id, created_at DESC);

-- 覆盖 today 端「按店 + 状态 + 时间」聚合（pending/preparing/completed 计数）
CREATE INDEX IF NOT EXISTS idx_orders_shop_status_created_at
  ON tf_orders(shop_id, status, created_at DESC);

-- ============================================================
-- 2) 今日统计 RPC：一次 SQL 聚合，Node 不再加载明细行
-- ============================================================

CREATE OR REPLACE FUNCTION get_today_stats(p_shop_id uuid)
RETURNS TABLE (
  total_orders integer,
  total_revenue bigint,
  pending_count integer,
  preparing_count integer,
  completed_count integer,
  source text
) AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_daily RECORD;
  v_has_daily boolean := false;
  v_total_orders integer := 0;
  v_completed_orders integer := 0;
BEGIN
  -- 兼容旧预聚合表：total_orders / completed_orders 优先取 tf_daily_stats
  SELECT ds.total_orders, ds.completed_orders
    INTO v_daily
    FROM tf_daily_stats ds
   WHERE ds.shop_id = p_shop_id
     AND ds.stat_date = v_today
   LIMIT 1;

  IF FOUND THEN
    v_has_daily := true;
    v_total_orders := COALESCE(v_daily.total_orders, 0);
    v_completed_orders := COALESCE(v_daily.completed_orders, 0);
  END IF;

  RETURN QUERY
  WITH today_orders AS (
    SELECT o.status, COALESCE(o.total, 0) AS total
      FROM tf_orders o
     WHERE o.shop_id = p_shop_id
       AND o.created_at >= date_trunc('day', now())
  )
  SELECT
    CASE WHEN v_has_daily
         THEN v_total_orders
         ELSE (SELECT COUNT(*)::integer FROM today_orders)
    END AS total_orders,
    COALESCE((
      SELECT SUM(total)::bigint
        FROM today_orders
       WHERE status IN ('completed', 'delivering', 'preparing')
    ), 0)::bigint AS total_revenue,
    COALESCE((
      SELECT COUNT(*)::integer
        FROM today_orders
       WHERE status IN ('paid', 'accepted')
    ), 0) AS pending_count,
    COALESCE((
      SELECT COUNT(*)::integer
        FROM today_orders
       WHERE status = 'preparing'
    ), 0) AS preparing_count,
    CASE WHEN v_has_daily
         THEN v_completed_orders
         ELSE COALESCE((
           SELECT COUNT(*)::integer
             FROM today_orders
            WHERE status = 'completed'
         ), 0)
    END AS completed_count,
    CASE WHEN v_has_daily
         THEN 'daily_stats+orders'
         ELSE 'orders'
    END AS source;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_today_stats(uuid) IS
  '今日订单统计聚合（v30）：单次 SQL 返回 total_orders/revenue/pending/preparing/completed，'
  '避免 Node 端加载 tf_orders 明细行。total_orders/completed_orders 优先用 tf_daily_stats 预聚合值。';

-- ============================================================
-- 3) 日趋势 RPC：PostgreSQL 端 GROUP BY 聚合
-- ============================================================

CREATE OR REPLACE FUNCTION get_daily_stats(
  p_shop_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  stat_date date,
  orders integer,
  revenue bigint
) AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_exclusive_ts timestamptz;
  v_min_date date;
  v_max_date date;
  v_span integer;
BEGIN
  -- 入参防呆
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    p_start_date := (now() AT TIME ZONE 'UTC')::date - 6;
    p_end_date := (now() AT TIME ZONE 'UTC')::date;
  END IF;
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'end_date < start_date';
  END IF;
  -- 跨度上限 366 天，与 service 端 ALL_TIME_MAX_DAYS 对齐
  v_span := LEAST((p_end_date - p_start_date) + 1, 366);

  v_start_ts := (p_start_date::timestamp) AT TIME ZONE 'UTC';
  v_end_exclusive_ts := ((p_end_date + 1)::timestamp) AT TIME ZONE 'UTC';

  -- 跨度裁剪到入参窗口，避免 SQL 端与 Node 端不一致
  v_min_date := GREATEST(p_start_date, p_end_date - (v_span - 1));
  v_max_date := p_end_date;

  RETURN QUERY
  WITH buckets AS (
    SELECT generate_series(v_min_date, v_max_date, '1 day')::date AS d
  ),
  agg AS (
    SELECT
      (o.created_at AT TIME ZONE 'UTC')::date AS d,
      COUNT(*)::integer AS orders,
      COALESCE(SUM(o.total) FILTER (
        WHERE o.status IN ('completed', 'delivering', 'preparing')
      ), 0)::bigint AS revenue
    FROM tf_orders o
    WHERE o.shop_id = p_shop_id
      AND o.created_at >= v_start_ts
      AND o.created_at < v_end_exclusive_ts
    GROUP BY 1
  )
  SELECT
    b.d AS stat_date,
    COALESCE(a.orders, 0) AS orders,
    COALESCE(a.revenue, 0) AS revenue
  FROM buckets b
  LEFT JOIN agg a ON a.d = b.d
  ORDER BY b.d ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_daily_stats(uuid, date, date) IS
  '日趋势聚合（v30）：PostgreSQL 端 GROUP BY 按日聚合，'
  'Node 端不再加载区间内全部订单行。日期桶由 generate_series 补齐零值日。';

-- ============================================================
-- 验证（务必全选整段 migration 后再 Run；末尾这两条仅用于手工验证）
-- ============================================================
-- 0) 先确认函数是否注册成功（应返回 2 行）：
--    SELECT proname, pronargs, pg_get_function_arguments(oid)
--      FROM pg_proc
--     WHERE proname IN ('get_today_stats', 'get_daily_stats');
--
-- 1) 调用（用 ::uuid 显式 cast，避免 unknown 推断失败）：
SELECT * FROM get_today_stats('00000000-0000-0000-0000-000000000001'::uuid);
SELECT * FROM get_daily_stats('00000000-0000-0000-0000-000000000001'::uuid,
                              CURRENT_DATE - 13, CURRENT_DATE);
