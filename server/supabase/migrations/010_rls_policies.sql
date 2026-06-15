-- 010_rls_policies.sql
-- Supabase Row Level Security 行级安全策略
-- 角色：customer（顾客）、admin（商家管理员）

-- 启用 RLS
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- ==================== shops ====================
-- 所有用户可查看营业中的店铺
CREATE POLICY "shops_select_all" ON shops
  FOR SELECT
  USING (status = 'open');

-- 仅管理员可管理店铺
CREATE POLICY "shops_insert_admin" ON shops
  FOR INSERT
  WITH CHECK (auth.role() = 'admin');

CREATE POLICY "shops_update_admin" ON shops
  FOR UPDATE
  USING (auth.role() = 'admin');

-- ==================== categories ====================
-- 所有人可查看分类
CREATE POLICY "categories_select_all" ON categories
  FOR SELECT
  USING (true);

-- 管理员可管理自己店铺的分类
CREATE POLICY "categories_admin" ON categories
  FOR ALL
  USING (
    auth.role() = 'admin'
    AND shop_id = (auth.jwt()->>'shop_id')::uuid
  );

-- ==================== menu_items ====================
-- 所有人可查看上架的菜品
CREATE POLICY "menu_items_select_all" ON menu_items
  FOR SELECT
  USING (status = 'active');

-- 管理员可管理自己店铺的菜品
CREATE POLICY "menu_items_admin" ON menu_items
  FOR ALL
  USING (
    auth.role() = 'admin'
    AND shop_id = (auth.jwt()->>'shop_id')::uuid
  );

-- ==================== spec_groups & spec_options ====================
-- 所有人可查看规格
CREATE POLICY "spec_groups_select_all" ON spec_groups
  FOR SELECT
  USING (true);

CREATE POLICY "spec_options_select_all" ON spec_options
  FOR SELECT
  USING (true);

-- 管理员可管理规格
CREATE POLICY "spec_groups_admin" ON spec_groups
  FOR ALL
  USING (
    auth.role() = 'admin'
    AND shop_id = (auth.jwt()->>'shop_id')::uuid
  );

CREATE POLICY "spec_options_admin" ON spec_options
  FOR ALL
  USING (
    auth.role() = 'admin'
    AND spec_group_id IN (
      SELECT id FROM spec_groups
      WHERE shop_id = (auth.jwt()->>'shop_id')::uuid
    )
  );

-- ==================== orders ====================
-- 顾客只能查看自己的订单
CREATE POLICY "orders_select_customer" ON orders
  FOR SELECT
  USING (
    auth.role() = 'customer'
    AND user_id = auth.jwt()->>'sub'
  );

-- 管理员可查看自己店铺的所有订单
CREATE POLICY "orders_select_admin" ON orders
  FOR SELECT
  USING (
    auth.role() = 'admin'
    AND shop_id = (auth.jwt()->>'shop_id')::uuid
  );

-- 顾客创建订单
CREATE POLICY "orders_insert_customer" ON orders
  FOR INSERT
  WITH CHECK (
    auth.role() = 'customer'
    AND user_id = auth.jwt()->>'sub'
  );

-- 管理员更新订单状态
CREATE POLICY "orders_update_admin" ON orders
  FOR UPDATE
  USING (
    auth.role() = 'admin'
    AND shop_id = (auth.jwt()->>'shop_id')::uuid
  );

-- ==================== order_items ====================
-- 顾客可查看自己订单的明细
CREATE POLICY "order_items_select_customer" ON order_items
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE user_id = auth.jwt()->>'sub'
    )
  );

-- 管理员可查看自己店铺的订单明细
CREATE POLICY "order_items_select_admin" ON order_items
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE shop_id = (auth.jwt()->>'shop_id')::uuid
    )
  );

-- 顾客创建订单时写入明细
CREATE POLICY "order_items_insert_customer" ON order_items
  FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders
      WHERE user_id = auth.jwt()->>'sub'
    )
  );

-- ==================== delivery_info ====================
CREATE POLICY "delivery_info_select_owner" ON delivery_info
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE user_id = auth.jwt()->>'sub'
        OR shop_id = (auth.jwt()->>'shop_id')::uuid
    )
  );

-- ==================== promotions (P1) ====================
CREATE POLICY "promotions_select_active" ON promotions
  FOR SELECT
  USING (status = 'active');

CREATE POLICY "promotions_admin" ON promotions
  FOR ALL
  USING (
    auth.role() = 'admin'
    AND shop_id = (auth.jwt()->>'shop_id')::uuid
  );
