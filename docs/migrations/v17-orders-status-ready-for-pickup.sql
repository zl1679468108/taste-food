-- v17: 补齐 tf_orders.status 允许 ready_for_pickup
-- 背景: 代码与 docs/database-init.sql 已支持待取餐状态，
-- 但线上库 tf_orders_status_check 仍为旧 8 态，导致 preparing → ready_for_pickup 失败。
-- 执行日期: 2026-07-29

ALTER TABLE public.tf_orders DROP CONSTRAINT IF EXISTS tf_orders_status_check;

ALTER TABLE public.tf_orders
  ADD CONSTRAINT tf_orders_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending_payment'::text,
        'paid'::text,
        'accepted'::text,
        'preparing'::text,
        'delivering'::text,
        'ready_for_pickup'::text,
        'completed'::text,
        'cancelled'::text,
        'rejected'::text
      ]
    )
  );
