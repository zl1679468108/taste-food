-- ============================================================
-- v33: 订单列表状态数量聚合 RPC
-- 目标: /api/orders 接口在返回分页列表的同时，附带各状态数量 counts，
--       前端 Tab 数字角标无需多次调用接口，后端用单条 SQL 聚合。
-- 日期: 2026-08-04
-- 幂等: CREATE OR REPLACE FUNCTION，可重跑
-- ============================================================

CREATE OR REPLACE FUNCTION count_orders_by_scope(
  p_scope_type text,
  p_scope_id text,
  p_keyword text
)
RETURNS TABLE (
  all_count integer,
  pending_payment integer,
  paid integer,
  accepted integer,
  preparing integer,
  ready_for_delivery integer,
  ready_for_pickup integer,
  delivering integer,
  refund integer,
  completed integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::integer AS all_count,
    COUNT(*) FILTER (WHERE o.status = 'pending_payment')::integer AS pending_payment,
    COUNT(*) FILTER (WHERE o.status = 'paid')::integer AS paid,
    COUNT(*) FILTER (WHERE o.status = 'accepted')::integer AS accepted,
    COUNT(*) FILTER (WHERE o.status = 'preparing')::integer AS preparing,
    COUNT(*) FILTER (WHERE o.status = 'ready_for_delivery')::integer AS ready_for_delivery,
    COUNT(*) FILTER (WHERE o.status = 'ready_for_pickup')::integer AS ready_for_pickup,
    COUNT(*) FILTER (WHERE o.status = 'delivering')::integer AS delivering,
    COUNT(*) FILTER (WHERE o.status IN ('cancelled', 'rejected') OR o.cancel_requested_at IS NOT NULL)::integer AS refund,
    COUNT(*) FILTER (WHERE o.status = 'completed')::integer AS completed
  FROM tf_orders o
  WHERE (
    CASE
      WHEN p_scope_type = 'user' THEN o.user_id = p_scope_id
      WHEN p_scope_type = 'shop' THEN (p_scope_id IS NULL OR p_scope_id = '' OR o.shop_id = p_scope_id::uuid)
      WHEN p_scope_type = 'rider' THEN o.rider_id = p_scope_id
      WHEN p_scope_type = 'pool' THEN
        o.delivery_type = 'delivery'
        AND o.rider_id IS NULL
        AND o.status IN ('ready_for_delivery', 'preparing', 'delivering')
        AND (p_scope_id IS NULL OR p_scope_id = '' OR o.shop_id = p_scope_id::uuid)
      ELSE TRUE
    END
  )
  AND (
    p_keyword IS NULL OR p_keyword = ''
    OR o.order_no ILIKE '%' || p_keyword || '%'
    OR o.contact_name ILIKE '%' || p_keyword || '%'
    OR o.contact_phone ILIKE '%' || p_keyword || '%'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION count_orders_by_scope(text, text, text) IS
  '订单列表状态数量聚合（v33）：单次 SQL 按作用域(user/shop/rider/pool)聚合各状态订单数，'
  '退款售后 = cancelled + rejected + cancel_requested_at 非空，避免前端/Node 端多次查询。';
