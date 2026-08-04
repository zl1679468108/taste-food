-- v33: 统计 RPC 时区统一为北京时间（Asia/Shanghai）
-- 修正 get_today_stats / get_daily_stats 此前用 UTC 划分「今天」与日期桶，
-- 导致北京时间 00:00–08:00 之间的订单被误算入「昨天」、日趋势按 UTC 分桶错位。
-- 仅修改时区常量（UTC → Asia/Shanghai），聚合逻辑与返回结构完全不变，幂等可重跑。

-- ============================================================
-- 1) 今日统计 RPC：时区改 Asia/Shanghai
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
  v_today date := (now() AT TIME ZONE 'Asia/Shanghai')::date;
  v_daily RECORD;
  v_has_daily boolean := false;
  v_total_orders integer := 0;
  v_completed_orders integer := 0;
BEGIN
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
       AND o.created_at >= (v_today::timestamp) AT TIME ZONE 'Asia/Shanghai'
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
  '今日订单统计聚合（v33，时区 Asia/Shanghai）：单次 SQL 返回 total_orders/revenue/pending/preparing/completed，'
  '避免 Node 端加载 tf_orders 明细行。total_orders/completed_orders 优先用 tf_daily_stats 预聚合值。';

-- ============================================================
-- 2) 日趋势 RPC：时区改 Asia/Shanghai
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
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    p_start_date := (now() AT TIME ZONE 'Asia/Shanghai')::date - 6;
    p_end_date := (now() AT TIME ZONE 'Asia/Shanghai')::date;
  END IF;
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'end_date < start_date';
  END IF;
  v_span := LEAST((p_end_date - p_start_date) + 1, 366);

  -- 前端传入的 date 视为「北京时间当天」，边界按北京时间 00:00 / 次日 00:00
  v_start_ts := (p_start_date::timestamp) AT TIME ZONE 'Asia/Shanghai';
  v_end_exclusive_ts := ((p_end_date + 1)::timestamp) AT TIME ZONE 'Asia/Shanghai';

  v_min_date := GREATEST(p_start_date, p_end_date - (v_span - 1));
  v_max_date := p_end_date;

  RETURN QUERY
  WITH buckets AS (
    SELECT generate_series(v_min_date, v_max_date, '1 day')::date AS d
  ),
  agg AS (
    SELECT
      (o.created_at AT TIME ZONE 'Asia/Shanghai')::date AS d,
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
  '日趋势聚合（v33，时区 Asia/Shanghai）：PostgreSQL 端 GROUP BY 按日聚合，'
  'Node 端不再加载区间内全部订单行。日期桶由 generate_series 补齐零值日。';
