-- v18: 订单状态历史表
-- 背景: 顾客端订单进度需要展示每个状态的完成/进入时间，单个 updated_at 无法还原中间节点。

CREATE TABLE IF NOT EXISTS "tf_order_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid NOT NULL REFERENCES tf_orders(id) ON DELETE CASCADE,
  "shop_id" uuid NOT NULL REFERENCES tf_shops(id) ON DELETE RESTRICT,
  "status" text NOT NULL CHECK (status IN ('pending_payment', 'paid', 'accepted', 'preparing', 'delivering', 'ready_for_pickup', 'completed', 'cancelled', 'rejected')),
  "from_status" text CHECK (from_status IS NULL OR from_status IN ('pending_payment', 'paid', 'accepted', 'preparing', 'delivering', 'ready_for_pickup', 'completed', 'cancelled', 'rejected')),
  "recorded_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  UNIQUE ("order_id", "status")
);
ALTER TABLE "tf_order_status_history" DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_time ON tf_order_status_history(order_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_order_status_history_shop_time ON tf_order_status_history(shop_id, recorded_at DESC);

-- 为历史订单补可展示轨迹：
-- 1) 下单时间；2) 支付时间（来自 tf_payments）；3) 商家状态操作时间（来自 tf_audit_logs）；4) 当前状态兜底。
INSERT INTO tf_order_status_history (order_id, shop_id, status, recorded_at, created_at)
SELECT id, shop_id, 'pending_payment', created_at, created_at
FROM tf_orders
ON CONFLICT (order_id, status) DO NOTHING;

INSERT INTO tf_order_status_history (order_id, shop_id, status, recorded_at, created_at)
SELECT p.order_id, o.shop_id, 'paid', MIN(COALESCE(p.paid_at, p.created_at)), MIN(COALESCE(p.paid_at, p.created_at))
FROM tf_payments p
JOIN tf_orders o ON o.id = p.order_id
WHERE p.status IN ('success', 'refunded')
GROUP BY p.order_id, o.shop_id
ON CONFLICT (order_id, status) DO NOTHING;

WITH audit_status AS (
  SELECT
    resource_id::uuid AS order_id,
    substring(summary from 'status=([a-z_]+)') AS status,
    MIN(created_at) AS recorded_at
  FROM tf_audit_logs
  WHERE resource = 'orders'
    AND resource_id IS NOT NULL
    AND action = '更新订单状态'
    AND substring(summary from 'status=([a-z_]+)') IN (
      'accepted',
      'preparing',
      'delivering',
      'ready_for_pickup',
      'completed',
      'cancelled',
      'rejected'
    )
  GROUP BY resource_id, substring(summary from 'status=([a-z_]+)')
)
INSERT INTO tf_order_status_history (order_id, shop_id, status, recorded_at, created_at)
SELECT a.order_id, o.shop_id, a.status, a.recorded_at, a.recorded_at
FROM audit_status a
JOIN tf_orders o ON o.id = a.order_id
ON CONFLICT (order_id, status) DO NOTHING;

INSERT INTO tf_order_status_history (order_id, shop_id, status, recorded_at, created_at)
SELECT id, shop_id, status, COALESCE(updated_at, created_at), COALESCE(updated_at, created_at)
FROM tf_orders
WHERE status <> 'pending_payment'
ON CONFLICT (order_id, status) DO NOTHING;

-- 更新原子建单 RPC：建单时写入 pending_payment 时间。
CREATE OR REPLACE FUNCTION atomic_create_order(
  p_order_id uuid,
  p_shop_id uuid,
  p_user_id text,
  p_total integer,
  p_delivery_fee integer,
  p_delivery_type text,
  p_address text,
  p_table_no text,
  p_remark text,
  p_contact_name text,
  p_contact_phone text,
  p_items jsonb,
  p_order_date date,
  p_invoice_needed boolean DEFAULT false,
  p_invoice_title text DEFAULT NULL,
  p_invoice_tax_no text DEFAULT NULL,
  p_order_no text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_item jsonb;
  v_order_id uuid;
BEGIN
  INSERT INTO tf_orders (id, order_no, shop_id, user_id, status, total, delivery_fee, delivery_type, address, table_no, remark, contact_name, contact_phone, invoice_needed, invoice_title, invoice_tax_no, created_at, updated_at)
  VALUES (p_order_id, p_order_no, p_shop_id, p_user_id, 'pending_payment', p_total, p_delivery_fee, p_delivery_type, p_address, p_table_no, p_remark, p_contact_name, p_contact_phone, COALESCE(p_invoice_needed, false), p_invoice_title, p_invoice_tax_no, now(), now())
  RETURNING id INTO v_order_id;

  INSERT INTO tf_order_status_history (order_id, shop_id, status, recorded_at)
  VALUES (v_order_id, p_shop_id, 'pending_payment', now())
  ON CONFLICT (order_id, status) DO NOTHING;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO tf_order_items (order_id, shop_id, menu_item_id, name, quantity, price, spec_desc, image_url)
    VALUES (
      v_order_id,
      p_shop_id,
      (v_item->>'menuItemId')::uuid,
      v_item->>'name',
      (v_item->>'quantity')::integer,
      (v_item->>'price')::integer,
      v_item->>'specDesc',
      v_item->>'imageUrl'
    );

    UPDATE tf_menu_items
    SET monthly_sales = COALESCE(monthly_sales, 0) + (v_item->>'quantity')::integer,
        updated_at = now()
    WHERE id = (v_item->>'menuItemId')::uuid
      AND shop_id = p_shop_id;

    INSERT INTO tf_item_sales (menu_item_id, shop_id, order_id, order_date, quantity, revenue)
    VALUES ((v_item->>'menuItemId')::uuid, p_shop_id, v_order_id, p_order_date, (v_item->>'quantity')::integer, 0);
  END LOOP;

  RETURN jsonb_build_object('orderId', v_order_id::text, 'success', true);
END;
$$ LANGUAGE plpgsql;

-- 更新原子状态 RPC：每次状态进入时写入历史。
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
    IF p_from_status = 'paid' THEN
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

-- PostgREST schema cache 刷新（可选；Supabase SQL Editor 执行后建议保留）
NOTIFY pgrst, 'reload schema';
