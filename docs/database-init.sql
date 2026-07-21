-- ============================================================
-- 小买卖点餐系统 - 数据库初始化脚本 (Supabase PostgreSQL)
-- 版本: v10.0 (与代码实现同步)
-- 更新日期: 2026-07-12
-- 包含所有核心业务表及结构，默认关闭 RLS。
-- 注意：此脚本必须与代码实现保持一致（三位一体同步）
-- v10.0 变更：
--   1. 补充高频查询字段索引（tf_order_items.order_id 等）
--   2. 为 text 枚举字段补充 CHECK 约束防止非法值
--   3. 外键补充 ON DELETE 行为（CASCADE/RESTRICT/SET NULL）
--   4. 补充缺失的 updated_at 时间戳
--   5. 多租户表补充 shop_id（tf_order_items/tf_delivery_info/tf_payments）
--   6. tf_users.userId 重命名为 user_id 符合 snake_case 规范
--   7. atomic_create_order p_user_id 类型从 uuid 改为 text 匹配 user_id 列
-- ============================================================

-- 1. 店铺表
CREATE TABLE IF NOT EXISTS "tf_shops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "avatar_url" text,
  "logo_url" text,
  "address" text,
  "phone" text,
  "status" text DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  "delivery_range" integer DEFAULT 3000, -- 配送范围（米），默认3km
  "delivery_fee" integer DEFAULT 500, -- 配送费（分），默认5元
  "min_order_amount" integer DEFAULT 0, -- 起送价（分）
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_shops" DISABLE ROW LEVEL SECURITY;

-- 2. 菜品分类表
CREATE TABLE IF NOT EXISTS "tf_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE CASCADE,
  "name" text NOT NULL,
  "icon_key" text,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_categories" DISABLE ROW LEVEL SECURITY;

-- 3. 菜品项目表
-- 注意：代码中使用 status ('active'|'inactive') 而非 is_available
-- 注意：spec_group_ids 存储关联的规格组 ID 数组
CREATE TABLE IF NOT EXISTS "tf_menu_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "category_id" uuid REFERENCES tf_categories(id) ON DELETE CASCADE,
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "price" integer NOT NULL, -- 单位：分
  "image_url" text,
  "status" text DEFAULT 'active' CHECK (status IN ('active', 'inactive')), -- active | inactive
  "monthly_sales" integer DEFAULT 0,
  "spec_group_ids" uuid[] DEFAULT '{}', -- 关联的规格组 ID 数组
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_menu_items" DISABLE ROW LEVEL SECURITY;

-- 4. 规格组表
-- 注意：规格组是 shop 级别，通过 menu_items.spec_group_ids 关联菜品
-- 注意：字段名与代码严格对应（shop_id, max_select, is_required）
CREATE TABLE IF NOT EXISTS "tf_spec_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE CASCADE,
  "name" text NOT NULL,
  "is_required" boolean DEFAULT false,
  "max_select" integer DEFAULT 1,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_spec_groups" DISABLE ROW LEVEL SECURITY;

-- 5. 规格选项表
-- 注意：group_id 在代码中对应 spec_group_id
CREATE TABLE IF NOT EXISTS "tf_spec_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "spec_group_id" uuid REFERENCES tf_spec_groups(id) ON DELETE CASCADE,
  "name" text NOT NULL,
  "price_adjust" integer DEFAULT 0, -- 价格修正（分）
  "is_default" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_spec_options" DISABLE ROW LEVEL SECURITY;

-- 6. 订单主表
-- 注意：代码中使用 rider_id 字段用于骑手配送
-- shop_id 使用 ON DELETE RESTRICT 防止误删有订单的店铺（订单为财务记录）
CREATE TABLE IF NOT EXISTS "tf_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE RESTRICT,
  "user_id" text NOT NULL, -- 存储微信 OpenID 或 Auth UID
  "rider_id" text, -- 骑手 ID（外送订单使用）
  "status" text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'accepted', 'preparing', 'delivering', 'ready_for_pickup', 'completed', 'cancelled', 'rejected')),
  "total" integer NOT NULL,
  "delivery_type" text NOT NULL CHECK (delivery_type IN ('delivery', 'pickup', 'dine_in')),
  "address" text,
  "table_no" text,
  "remark" text,
  "contact_name" text,
  "contact_phone" text,
  "delivery_fee" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_orders" DISABLE ROW LEVEL SECURITY;

-- 7. 订单明细表
-- shop_id 多租户字段，便于按店铺维度统计订单明细
-- menu_item_id 不设外键（历史快照，菜品删除后订单记录保留）
CREATE TABLE IF NOT EXISTS "tf_order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid REFERENCES tf_orders(id) ON DELETE CASCADE,
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE RESTRICT,
  "menu_item_id" uuid NOT NULL,
  "name" text NOT NULL,
  "quantity" integer NOT NULL,
  "price" integer NOT NULL,
  "spec_desc" text,
  "image_url" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_order_items" DISABLE ROW LEVEL SECURITY;

-- 8. 配送信息表（预留，目前未在代码中主动使用）
CREATE TABLE IF NOT EXISTS "tf_delivery_info" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid REFERENCES tf_orders(id) ON DELETE CASCADE,
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE RESTRICT,
  "courier_name" text,
  "courier_phone" text,
  "estimated_delivery_at" timestamptz,
  "delivered_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_delivery_info" DISABLE ROW LEVEL SECURITY;

-- 9. 营销/促销表
-- 注意：代码中使用 name, rule(jsonb), status, start_date, end_date
-- 与早期版本的 title/threshold/discount/is_active/start_at/end_at 已不兼容
CREATE TABLE IF NOT EXISTS "tf_promotions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" text NOT NULL CHECK (type IN ('full_discount', 'first_order', 'coupon')),
  "description" text,
  "rule" jsonb DEFAULT '{}', -- { threshold: number, discount: number }
  "status" text DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'expired')),
  "start_date" timestamptz,
  "end_date" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_promotions" DISABLE ROW LEVEL SECURITY;

-- 10. 用户扩展表
-- 注意：openid 为唯一标识；user_id（原 userId）为预留字段，符合 snake_case 规范
CREATE TABLE IF NOT EXISTS "tf_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "openid" text UNIQUE NOT NULL,
  "user_id" text, -- 对应 Auth 系统的标识（预留，符合 snake_case 规范）
  "role" text DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'rider')),
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE SET NULL, -- 多租户：admin 必填，绑定管理的店铺；customer/rider 可空
  "nick_name" text,
  "avatar_url" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_users" DISABLE ROW LEVEL SECURITY;

-- 10.1 Refresh Token 持久化表
-- 替代内存 Map，支持多实例部署与重启不失效
CREATE TABLE IF NOT EXISTS "tf_refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "token_hash" text NOT NULL, -- refresh_token 的哈希值（不存明文）
  "user_id" text NOT NULL, -- 对应 tf_users.id
  "expires_at" timestamptz NOT NULL,
  "revoked" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_refresh_tokens" DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON tf_refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON tf_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON tf_refresh_tokens(expires_at);

-- 11. 支付记录表
CREATE TABLE IF NOT EXISTS "tf_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid REFERENCES tf_orders(id) ON DELETE CASCADE,
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE RESTRICT,
  "user_id" text,
  "transaction_id" text,
  "amount" integer NOT NULL,
  "method" text DEFAULT 'wechat' CHECK (method IN ('wechat', 'alipay', 'balance')),
  "status" text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  "paid_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_payments" DISABLE ROW LEVEL SECURITY;

-- 12. 菜品收藏表
CREATE TABLE IF NOT EXISTS "tf_favorites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "menu_item_id" uuid REFERENCES tf_menu_items(id) ON DELETE CASCADE,
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now(),
  UNIQUE("user_id", "menu_item_id")
);
ALTER TABLE "tf_favorites" DISABLE ROW LEVEL SECURITY;

-- 收藏表索引
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON tf_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_menu_item_id ON tf_favorites(menu_item_id);

-- ============================================================
-- 以下为索引优化（提升查询性能）
-- ============================================================

-- 订单查询常用索引
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON tf_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON tf_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON tf_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON tf_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON tf_orders(rider_id);

-- 订单明细查询索引（order_id 高频关联查询，原缺失致全表扫描）
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON tf_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shop_id ON tf_order_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON tf_order_items(menu_item_id);

-- 菜品查询常用索引
CREATE INDEX IF NOT EXISTS idx_menu_items_shop_id ON tf_menu_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON tf_menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_status ON tf_menu_items(status);

-- 分类与规格索引
CREATE INDEX IF NOT EXISTS idx_categories_shop_id ON tf_categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_spec_groups_shop_id ON tf_spec_groups(shop_id);
CREATE INDEX IF NOT EXISTS idx_spec_options_spec_group_id ON tf_spec_options(spec_group_id);

-- 用户查询常用索引
CREATE INDEX IF NOT EXISTS idx_users_openid ON tf_users(openid);
CREATE INDEX IF NOT EXISTS idx_users_role ON tf_users(role);

-- 支付记录索引（order_id 关联查询，原缺失）
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON tf_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON tf_payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON tf_payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON tf_payments(user_id);

-- 促销索引（shop_id 多租户查询，原缺失）
CREATE INDEX IF NOT EXISTS idx_promotions_shop_id ON tf_promotions(shop_id);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON tf_promotions(status);

-- 配送信息索引
CREATE INDEX IF NOT EXISTS idx_delivery_info_order_id ON tf_delivery_info(order_id);

-- ============================================================
-- 数据一致性优化（v9.2）
-- 新增：tf_daily_stats 聚合表 + 原子更新 RPC 函数
-- ============================================================

-- 14. 每日销售统计表
CREATE TABLE IF NOT EXISTS "tf_daily_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE CASCADE,
  "stat_date" date NOT NULL,
  "total_orders" integer DEFAULT 0,
  "total_revenue" integer DEFAULT 0,
  "completed_orders" integer DEFAULT 0,
  "cancelled_orders" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  UNIQUE(shop_id, stat_date)
);
ALTER TABLE "tf_daily_stats" DISABLE ROW LEVEL SECURITY;

-- 每日统计索引
CREATE INDEX IF NOT EXISTS idx_daily_stats_shop_date ON tf_daily_stats(shop_id, stat_date);

-- 15. 菜品销售明细表（用于精确统计和历史追溯）
-- menu_item_id/order_id 使用 ON DELETE SET NULL 保留历史销量记录
CREATE TABLE IF NOT EXISTS "tf_item_sales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "menu_item_id" uuid REFERENCES tf_menu_items(id) ON DELETE SET NULL,
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE CASCADE,
  "order_id" uuid REFERENCES tf_orders(id) ON DELETE SET NULL,
  "order_date" date NOT NULL,
  "quantity" integer NOT NULL DEFAULT 0,
  "revenue" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_item_sales" DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_item_sales_menu_item ON tf_item_sales(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_item_sales_shop_date ON tf_item_sales(shop_id, order_date);
CREATE INDEX IF NOT EXISTS idx_item_sales_order_id ON tf_item_sales(order_id);

-- 原子更新菜品销量的 RPC 函数（防止并发竞态）
CREATE OR REPLACE FUNCTION atomic_increment_menu_sales(
  p_menu_item_id uuid,
  p_quantity integer,
  p_shop_id uuid,
  p_order_date date
) RETURNS void AS $$
DECLARE
  v_current_sales integer;
BEGIN
  -- 乐观锁：先读后写，用 WHERE 条件保证原子性
  UPDATE tf_menu_items
  SET monthly_sales = monthly_sales + p_quantity,
      updated_at = now()
  WHERE id = p_menu_item_id
    AND shop_id = p_shop_id;

  -- 记录到菜品销售明细表
  INSERT INTO tf_item_sales (menu_item_id, shop_id, order_id, order_date, quantity, revenue)
  VALUES (p_menu_item_id, p_shop_id, NULL, p_order_date, p_quantity, 0);
END;
$$ LANGUAGE plpgsql;

-- 原子更新每日统计表的 RPC 函数
CREATE OR REPLACE FUNCTION atomic_update_daily_stats(
  p_shop_id uuid,
  p_stat_date date,
  p_order_delta integer,
  p_revenue_delta integer,
  p_completed_delta integer,
  p_cancelled_delta integer
) RETURNS void AS $$
BEGIN
  INSERT INTO tf_daily_stats (shop_id, stat_date, total_orders, total_revenue, completed_orders, cancelled_orders)
  VALUES (p_shop_id, p_stat_date, p_order_delta, p_revenue_delta, p_completed_delta, p_cancelled_delta)
  ON CONFLICT (shop_id, stat_date)
  DO UPDATE SET
    total_orders = tf_daily_stats.total_orders + p_order_delta,
    total_revenue = tf_daily_stats.total_revenue + p_revenue_delta,
    completed_orders = tf_daily_stats.completed_orders + p_completed_delta,
    cancelled_orders = tf_daily_stats.cancelled_orders + p_cancelled_delta,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- 原子创建订单：在一个事务内插入订单、订单项、更新销量
-- p_user_id 类型为 text 与 tf_orders.user_id 列类型一致（存储 OpenID 或 Auth UID）
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
  p_order_date date
) RETURNS jsonb AS $$
DECLARE
  v_item jsonb;
  v_order_id uuid;
BEGIN
  -- Step 1: Insert order
  INSERT INTO tf_orders (id, shop_id, user_id, status, total, delivery_fee, delivery_type, address, table_no, remark, contact_name, contact_phone, created_at, updated_at)
  VALUES (p_order_id, p_shop_id, p_user_id, 'pending_payment', p_total, p_delivery_fee, p_delivery_type, p_address, p_table_no, p_remark, p_contact_name, p_contact_phone, now(), now())
  RETURNING id INTO v_order_id;

  -- Step 2: Insert order items and increment sales atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert order item (含 shop_id 多租户字段)
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

    -- Increment monthly sales
    UPDATE tf_menu_items
    SET monthly_sales = COALESCE(monthly_sales, 0) + (v_item->>'quantity')::integer,
        updated_at = now()
    WHERE id = (v_item->>'menuItemId')::uuid
      AND shop_id = p_shop_id;

    -- Record item sales
    INSERT INTO tf_item_sales (menu_item_id, shop_id, order_id, order_date, quantity, revenue)
    VALUES ((v_item->>'menuItemId')::uuid, p_shop_id, v_order_id, p_order_date, (v_item->>'quantity')::integer, 0);
  END LOOP;

  -- Return created order ID
  RETURN jsonb_build_object('orderId', v_order_id::text, 'success', true);
END;
$$ LANGUAGE plpgsql;

-- 原子删除分类：在一个事务内删除关联菜品和分类，避免中间失败导致数据不一致
CREATE OR REPLACE FUNCTION atomic_delete_category(
  p_category_id uuid
) RETURNS void AS $$
BEGIN
  -- Step 1: 删除该分类下的所有菜品
  DELETE FROM tf_menu_items WHERE category_id = p_category_id;

  -- Step 2: 删除分类本身
  DELETE FROM tf_categories WHERE id = p_category_id;
END;
$$ LANGUAGE plpgsql;

-- 原子更新订单状态：在单个事务内完成状态校验 + 订单状态更新 + 每日统计联动
-- 通过乐观锁（WHERE status = p_from_status）保证状态流转原子性，避免并发覆盖
-- 返回 jsonb: { success, previousStatus, newStatus, shopId, orderDate }
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
  -- Step 1: 读取当前订单（带锁）
  SELECT * INTO v_order FROM tf_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '订单 % 不存在', p_order_id;
  END IF;

  -- Step 2: 校验状态匹配（乐观锁）
  IF v_order.status <> p_from_status THEN
    RAISE EXCEPTION '订单状态不匹配：期望 %，实际 %', p_from_status, v_order.status;
  END IF;

  -- Step 3: 更新订单状态
  UPDATE tf_orders
  SET status = p_to_status, updated_at = now()
  WHERE id = p_order_id;

  v_order_date := (v_order.created_at AT TIME ZONE 'Asia/Shanghai')::date;

  -- Step 4: 计算 daily_stats delta
  -- 新订单计数：PENDING_PAYMENT -> PAID
  IF p_from_status = 'pending_payment' AND p_to_status = 'paid' THEN
    v_order_delta := 1;
  END IF;

  -- 完成计数：DELIVERING/READY_FOR_PICKUP -> COMPLETED
  IF p_from_status IN ('delivering', 'ready_for_pickup') AND p_to_status = 'completed' THEN
    v_completed_delta := 1;
    v_revenue_delta := v_order.total;
  END IF;

  -- 取消计数：PENDING_PAYMENT/PAID -> CANCELLED
  IF p_to_status = 'cancelled' THEN
    v_cancelled_delta := 1;
    IF p_from_status = 'paid' THEN
      -- 已支付取消：冲减收入
      v_revenue_delta := -(v_order.total);
    END IF;
  END IF;

  -- Step 5: 更新 daily_stats
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

-- 原子取消订单：在单个事务内完成状态校验 + 支付记录退款 + 订单状态更新 + 每日统计联动
-- 返回 jsonb: { success, previousStatus, refunded: boolean }
CREATE OR REPLACE FUNCTION atomic_cancel_order(
  p_order_id uuid,
  p_user_id text
) RETURNS jsonb AS $$
DECLARE
  v_order tf_orders%ROWTYPE;
  v_refunded boolean := false;
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

  -- Step 3: 状态校验
  IF v_order.status NOT IN ('pending_payment', 'paid') THEN
    RAISE EXCEPTION '订单状态为 %，不允许取消', v_order.status;
  END IF;

  -- Step 4: 已支付订单退款（更新支付记录状态为 refunded）
  IF v_order.status = 'paid' THEN
    UPDATE tf_payments
    SET status = 'refunded', updated_at = now()
    WHERE order_id = p_order_id AND status = 'success';
    GET DIAGNOSTICS v_refunded = ROW_COUNT;
    v_refunded := (v_refunded > 0);
  END IF;

  -- Step 5: 调用原子状态更新 RPC（内部完成订单状态 + daily_stats 更新）
  PERFORM atomic_update_order_status(p_order_id, v_order.status, 'cancelled');

  RETURN jsonb_build_object(
    'success', true,
    'previousStatus', v_order.status,
    'refunded', v_refunded
  );
END;
$$ LANGUAGE plpgsql;

-- 原子支付订单：在单个事务内完成支付记录插入 + 订单状态更新 + 每日统计联动
-- 返回 jsonb: { success, transactionId, previousStatus }
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
    'success',
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
