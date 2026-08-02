-- v22: 支付成功态统一为 paid，退款兼容历史 success
-- 问题：支付写入 success，售后 UI 只认 paid/refunded，已支付拒单会显示「未产生支付，无需退款」
-- 同时拒单未标记退款，取消 RPC 只匹配 success

-- 1) 对齐 CHECK：允许 pending/paid/success/refunded/failed
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'tf_payments'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tf_payments DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE tf_payments
    ADD CONSTRAINT tf_payments_status_check
    CHECK (status IN ('pending', 'paid', 'success', 'refunded', 'failed'));
END $$;

-- 2) 历史 success 规范为 paid（未退款的有效支付）
UPDATE tf_payments
SET status = 'paid', updated_at = now()
WHERE status = 'success';

-- 3) 已拒单/已取消订单：有效支付补标 refunded
UPDATE tf_payments p
SET status = 'refunded', updated_at = now()
FROM tf_orders o
WHERE p.order_id = o.id
  AND o.status IN ('rejected', 'cancelled')
  AND p.status IN ('paid', 'success');

-- 4) 原子取消：退款匹配 paid + 历史 success
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
  -- Step 1: 读取订单（带锁）
  SELECT * INTO v_order FROM tf_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '订单 % 不存在', p_order_id;
  END IF;

  -- Step 2: 权限校验（顾客只能取消自己的订单）
  IF p_user_id IS NOT NULL AND v_order.user_id <> p_user_id THEN
    RAISE EXCEPTION '不能取消他人的订单';
  END IF;

  -- Step 3: 状态校验（顾客 / 商家分流）
  IF p_user_id IS NOT NULL THEN
    IF v_order.status <> ALL (v_allowed_customer) THEN
      RAISE EXCEPTION '订单状态为 %，不允许取消', v_order.status;
    END IF;
  ELSE
    IF v_order.status <> ALL (v_allowed_merchant) THEN
      RAISE EXCEPTION '订单状态为 %，不允许取消', v_order.status;
    END IF;
  END IF;

  -- Step 4: 非待支付订单退款（paid 及接单后关单）
  IF v_order.status <> 'pending_payment' THEN
    UPDATE tf_payments
    SET status = 'refunded', updated_at = now()
    WHERE order_id = p_order_id AND status IN ('success', 'paid');
    GET DIAGNOSTICS v_refunded = ROW_COUNT;
    v_refunded := (v_refunded > 0);
  END IF;

  -- Step 5: 调用原子状态更新 RPC（内部完成订单状态 + daily_stats 更新）
  PERFORM atomic_update_order_status(p_order_id, v_order.status, 'cancelled');

  -- Step 6: 清理申请取消标记
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

-- 5) 原子支付：写入 paid
CREATE OR REPLACE FUNCTION atomic_pay_order(
  p_order_id uuid,
  p_user_id text,
  p_amount integer,
  p_transaction_id uuid,
  p_method text DEFAULT 'wechat'
) RETURNS jsonb AS $$
DECLARE
  v_order tf_orders%ROWTYPE;
  v_previous_status text;
BEGIN
  -- Step 1: 读取订单（带锁）
  SELECT * INTO v_order FROM tf_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '订单 % 不存在', p_order_id;
  END IF;

  -- Step 2: 权限校验（顾客只能支付自己的订单）
  IF p_user_id IS NOT NULL AND v_order.user_id <> p_user_id THEN
    RAISE EXCEPTION '不能支付他人的订单';
  END IF;

  -- Step 3: 状态校验
  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION '订单状态为 %，不允许支付', v_order.status;
  END IF;

  -- Step 4: 插入支付记录
  INSERT INTO tf_payments (id, order_id, shop_id, user_id, transaction_id, amount, method, status, paid_at)
  VALUES (
    p_transaction_id,
    p_order_id,
    v_order.shop_id,
    p_user_id,
    p_transaction_id::text,
    p_amount,
    p_method,
    'paid',
    now()
  );

  v_previous_status := v_order.status;

  -- Step 5: 调用原子状态更新 RPC（内部完成订单状态 + daily_stats 更新）
  PERFORM atomic_update_order_status(p_order_id, v_order.status, 'paid');

  RETURN jsonb_build_object(
    'success', true,
    'transactionId', p_transaction_id,
    'previousStatus', v_previous_status
  );
END;
$$ LANGUAGE plpgsql;
