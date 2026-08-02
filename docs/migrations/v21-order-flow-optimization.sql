-- v21: 订单流程优化
-- 1) 新增 ready_for_delivery 状态（外卖出餐待抢）
-- 2) 预计完成时间 / 催单 / 申请取消字段
-- 3) 扩展 atomic_cancel_order 支持商家接单后关单退款
-- 4) daily_stats：接单后取消也计 cancelled，已支付后取消冲减收入需按是否曾计入调整（简化：非 pending 取消计 cancelled）

BEGIN;

-- 1. 扩展 tf_orders status check
ALTER TABLE tf_orders DROP CONSTRAINT IF EXISTS tf_orders_status_check;
ALTER TABLE tf_orders ADD CONSTRAINT tf_orders_status_check CHECK (
  status IN (
    'pending_payment', 'paid', 'accepted', 'preparing',
    'ready_for_delivery', 'ready_for_pickup', 'delivering',
    'completed', 'cancelled', 'rejected'
  )
);

-- 2. 扩展 status history check
ALTER TABLE tf_order_status_history DROP CONSTRAINT IF EXISTS tf_order_status_history_status_check;
ALTER TABLE tf_order_status_history ADD CONSTRAINT tf_order_status_history_status_check CHECK (
  status IN (
    'pending_payment', 'paid', 'accepted', 'preparing',
    'ready_for_delivery', 'ready_for_pickup', 'delivering',
    'completed', 'cancelled', 'rejected'
  )
);

ALTER TABLE tf_order_status_history DROP CONSTRAINT IF EXISTS tf_order_status_history_from_status_check;
ALTER TABLE tf_order_status_history ADD CONSTRAINT tf_order_status_history_from_status_check CHECK (
  from_status IS NULL OR from_status IN (
    'pending_payment', 'paid', 'accepted', 'preparing',
    'ready_for_delivery', 'ready_for_pickup', 'delivering',
    'completed', 'cancelled', 'rejected'
  )
);

-- 3. 新字段
ALTER TABLE tf_orders ADD COLUMN IF NOT EXISTS estimated_completion timestamptz;
ALTER TABLE tf_orders ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;
ALTER TABLE tf_orders ADD COLUMN IF NOT EXISTS cancel_request_reason text;
ALTER TABLE tf_orders ADD COLUMN IF NOT EXISTS last_urged_at timestamptz;
ALTER TABLE tf_orders ADD COLUMN IF NOT EXISTS urge_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN tf_orders.estimated_completion IS '预计出餐/完成时间';
COMMENT ON COLUMN tf_orders.cancel_requested_at IS '顾客申请取消时间';
COMMENT ON COLUMN tf_orders.cancel_request_reason IS '顾客申请取消原因';
COMMENT ON COLUMN tf_orders.last_urged_at IS '最近一次催单时间';
COMMENT ON COLUMN tf_orders.urge_count IS '催单次数';

-- 4. 历史 delivering 且无骑手的单，迁移为 ready_for_delivery（可选安全迁移）
UPDATE tf_orders
SET status = 'ready_for_delivery', updated_at = now()
WHERE delivery_type = 'delivery'
  AND status = 'delivering'
  AND (rider_id IS NULL OR rider_id = '');

-- 5. 扩展取消 RPC：商家/系统可取消更多状态；已产生支付的一律尝试退款
CREATE OR REPLACE FUNCTION atomic_cancel_order(
  p_order_id uuid,
  p_user_id text
) RETURNS jsonb AS $$
DECLARE
  v_order tf_orders%ROWTYPE;
  v_refunded boolean := false;
  v_allowed_customer text[] := ARRAY['pending_payment', 'paid'];
  v_allowed_merchant text[] := ARRAY[
    'pending_payment', 'paid', 'accepted', 'preparing',
    'ready_for_delivery', 'ready_for_pickup'
  ];
BEGIN
  SELECT * INTO v_order FROM tf_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '订单 % 不存在', p_order_id;
  END IF;

  IF p_user_id IS NOT NULL AND v_order.user_id <> p_user_id THEN
    RAISE EXCEPTION '不能取消他人的订单';
  END IF;

  IF p_user_id IS NOT NULL THEN
    IF v_order.status <> ALL (v_allowed_customer) THEN
      RAISE EXCEPTION '订单状态为 %，不允许取消', v_order.status;
    END IF;
  ELSE
    IF v_order.status <> ALL (v_allowed_merchant) THEN
      RAISE EXCEPTION '订单状态为 %，不允许取消', v_order.status;
    END IF;
  END IF;

  -- 非待支付：尝试退款（paid 及接单后关单）
  IF v_order.status <> 'pending_payment' THEN
    UPDATE tf_payments
    SET status = 'refunded', updated_at = now()
    WHERE order_id = p_order_id AND status = 'success';
    GET DIAGNOSTICS v_refunded = ROW_COUNT;
    v_refunded := (v_refunded > 0);
  END IF;

  PERFORM atomic_update_order_status(p_order_id, v_order.status, 'cancelled');

  -- 清理申请取消标记
  UPDATE tf_orders
  SET cancel_requested_at = NULL,
      cancel_request_reason = NULL,
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'previousStatus', v_order.status,
    'refunded', v_refunded
  );
END;
$$ LANGUAGE plpgsql;

-- 6. daily_stats：接单后取消也计 cancelled；从 accepted+ 取消时若此前已 paid 计入订单，冲减需谨慎
-- 简化策略：cancelled 一律 +1；若 from 不是 pending_payment 则 revenue -total（可能对 paid 未完成单多减，与旧逻辑对 paid 一致）
CREATE OR REPLACE FUNCTION atomic_update_order_status(
  p_order_id uuid,
  p_from_status text,
  p_to_status text
) RETURNS jsonb AS $$
DECLARE
  v_order tf_orders%ROWTYPE;
  v_order_date date;
  v_order_delta integer := 0;
  v_revenue_delta integer := 0;
  v_completed_delta integer := 0;
  v_cancelled_delta integer := 0;
BEGIN
  SELECT * INTO v_order FROM tf_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '订单 % 不存在', p_order_id;
  END IF;

  IF v_order.status <> p_from_status THEN
    RAISE EXCEPTION '订单状态不匹配：期望 %，实际 %', p_from_status, v_order.status;
  END IF;

  UPDATE tf_orders
  SET status = p_to_status, updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO tf_order_status_history (order_id, shop_id, status, from_status, recorded_at)
  VALUES (p_order_id, v_order.shop_id, p_to_status, p_from_status, now())
  ON CONFLICT (order_id, status) DO NOTHING;

  v_order_date := (v_order.created_at AT TIME ZONE 'Asia/Shanghai')::date;

  IF p_from_status = 'pending_payment' AND p_to_status = 'paid' THEN
    v_order_delta := 1;
  END IF;

  IF p_from_status IN ('delivering', 'ready_for_pickup') AND p_to_status = 'completed' THEN
    v_completed_delta := 1;
    v_revenue_delta := v_order.total;
  END IF;

  IF p_to_status = 'cancelled' THEN
    v_cancelled_delta := 1;
    IF p_from_status <> 'pending_payment' THEN
      -- 已支付及之后取消：冲减（paid 计入 total_orders 后取消不减 total_orders，只减潜在收入）
      -- 与历史 paid 取消逻辑对齐：冲减 revenue
      v_revenue_delta := -(v_order.total);
    END IF;
  END IF;

  IF v_order_delta <> 0 OR v_revenue_delta <> 0 OR v_completed_delta <> 0 OR v_cancelled_delta <> 0 THEN
    INSERT INTO tf_daily_stats (shop_id, stat_date, total_orders, total_revenue, completed_orders, cancelled_orders)
    VALUES (v_order.shop_id, v_order_date, v_order_delta, v_revenue_delta, v_completed_delta, v_cancelled_delta)
    ON CONFLICT (shop_id, stat_date)
    DO UPDATE SET
      total_orders = tf_daily_stats.total_orders + EXCLUDED.total_orders,
      total_revenue = tf_daily_stats.total_revenue + EXCLUDED.total_revenue,
      completed_orders = tf_daily_stats.completed_orders + EXCLUDED.completed_orders,
      cancelled_orders = tf_daily_stats.cancelled_orders + EXCLUDED.cancelled_orders,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'previousStatus', p_from_status,
    'newStatus', p_to_status,
    'shopId', v_order.shop_id,
    'orderDate', v_order_date,
    'total', v_order.total
  );
END;
$$ LANGUAGE plpgsql;

COMMIT;
