-- ============================================================
-- 小买卖点餐系统 - 数据库初始化脚本 (Supabase PostgreSQL)
-- 版本: v9.0 (与代码实现同步)
-- 更新日期: 2026-06-24
-- 包含所有核心业务表及结构，默认关闭 RLS。
-- 注意：此脚本必须与代码实现保持一致（三位一体同步）
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
  "status" text DEFAULT 'open',
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
  "shop_id" uuid REFERENCES tf_shops(id),
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
  "category_id" uuid REFERENCES tf_categories(id),
  "shop_id" uuid REFERENCES tf_shops(id),
  "name" text NOT NULL,
  "description" text,
  "price" integer NOT NULL, -- 单位：分
  "image_url" text,
  "status" text DEFAULT 'active', -- active | inactive
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
  "shop_id" uuid REFERENCES tf_shops(id),
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
  "spec_group_id" uuid REFERENCES tf_spec_groups(id),
  "name" text NOT NULL,
  "price_adjust" integer DEFAULT 0, -- 价格修正（分）
  "is_default" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_spec_options" DISABLE ROW LEVEL SECURITY;

-- 6. 订单主表
-- 注意：代码中使用 rider_id 字段用于骑手配送
CREATE TABLE IF NOT EXISTS "tf_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid REFERENCES tf_shops(id),
  "user_id" text NOT NULL, -- 存储微信 OpenID 或 Auth UID
  "rider_id" text, -- 骑手 ID（外送订单使用）
  "status" text NOT NULL DEFAULT 'pending_payment',
  "total" integer NOT NULL,
  "delivery_type" text NOT NULL, -- delivery, pickup, dine_in
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
CREATE TABLE IF NOT EXISTS "tf_order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid REFERENCES tf_orders(id) ON DELETE CASCADE,
  "menu_item_id" uuid NOT NULL,
  "name" text NOT NULL,
  "quantity" integer NOT NULL,
  "price" integer NOT NULL,
  "spec_desc" text,
  "image_url" text,
  "created_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_order_items" DISABLE ROW LEVEL SECURITY;

-- 8. 配送信息表（预留，目前未在代码中主动使用）
CREATE TABLE IF NOT EXISTS "tf_delivery_info" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid REFERENCES tf_orders(id),
  "courier_name" text,
  "courier_phone" text,
  "estimated_delivery_at" timestamptz,
  "delivered_at" timestamptz
);
ALTER TABLE "tf_delivery_info" DISABLE ROW LEVEL SECURITY;

-- 9. 营销/促销表
-- 注意：代码中使用 name, rule(jsonb), status, start_date, end_date
-- 与早期版本的 title/threshold/discount/is_active/start_at/end_at 已不兼容
CREATE TABLE IF NOT EXISTS "tf_promotions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid REFERENCES tf_shops(id),
  "name" text NOT NULL,
  "type" text NOT NULL, -- full_discount, first_order, coupon
  "description" text,
  "rule" jsonb DEFAULT '{}', -- { threshold: number, discount: number }
  "status" text DEFAULT 'inactive', -- active | inactive | expired
  "start_date" timestamptz,
  "end_date" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_promotions" DISABLE ROW LEVEL SECURITY;

-- 10. 用户扩展表
-- 注意：openid 为唯一标识，代码中未使用 userId 字段（可保留兼容）
CREATE TABLE IF NOT EXISTS "tf_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "openid" text UNIQUE NOT NULL,
  "userId" text, -- 对应 Auth 系统的标识（预留）
  "role" text DEFAULT 'customer', -- customer | admin | rider
  "nick_name" text,
  "avatar_url" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_users" DISABLE ROW LEVEL SECURITY;

-- 11. 支付记录表
CREATE TABLE IF NOT EXISTS "tf_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" uuid REFERENCES tf_orders(id),
  "user_id" text,
  "transaction_id" text,
  "amount" integer NOT NULL,
  "method" text DEFAULT 'wechat',
  "status" text DEFAULT 'pending',
  "paid_at" timestamptz,
  "created_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_payments" DISABLE ROW LEVEL SECURITY;

-- 12. 菜品收藏表
CREATE TABLE IF NOT EXISTS "tf_favorites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "menu_item_id" uuid REFERENCES tf_menu_items(id) ON DELETE CASCADE,
  "shop_id" uuid REFERENCES tf_shops(id),
  "created_at" timestamptz DEFAULT now(),
  UNIQUE("user_id", "menu_item_id")
);
ALTER TABLE "tf_favorites" DISABLE ROW LEVEL SECURITY;

-- 收藏表索引
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON tf_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_menu_item_id ON tf_favorites(menu_item_id);

-- ============================================================
-- 以下为可选的索引优化（提升查询性能）
-- ============================================================

-- 订单查询常用索引
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON tf_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON tf_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON tf_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON tf_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON tf_orders(rider_id);

-- 菜品查询常用索引
CREATE INDEX IF NOT EXISTS idx_menu_items_shop_id ON tf_menu_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON tf_menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_status ON tf_menu_items(status);

-- 用户查询常用索引
CREATE INDEX IF NOT EXISTS idx_users_openid ON tf_users(openid);
CREATE INDEX IF NOT EXISTS idx_users_role ON tf_users(role);

-- ============================================================
-- 数据一致性优化（v9.2）
-- 新增：tf_daily_stats 聚合表 + 原子更新 RPC 函数
-- ============================================================

-- 12. 每日销售统计表
CREATE TABLE IF NOT EXISTS "tf_daily_stats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid REFERENCES tf_shops(id),
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

-- 13. 菜品销售明细表（用于精确统计和历史追溯）
CREATE TABLE IF NOT EXISTS "tf_item_sales" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "menu_item_id" uuid REFERENCES tf_menu_items(id),
  "shop_id" uuid REFERENCES tf_shops(id),
  "order_id" uuid REFERENCES tf_orders(id),
  "order_date" date NOT NULL,
  "quantity" integer NOT NULL DEFAULT 0,
  "revenue" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_item_sales" DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_item_sales_menu_item ON tf_item_sales(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_item_sales_shop_date ON tf_item_sales(shop_id, order_date);

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
CREATE OR REPLACE FUNCTION atomic_create_order(
  p_order_id uuid,
  p_shop_id uuid,
  p_user_id uuid,
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
    -- Insert order item
    INSERT INTO tf_order_items (order_id, menu_item_id, name, quantity, price, spec_desc, image_url)
    VALUES (
      v_order_id,
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
