-- ====================================================================
-- 小买卖点餐系统 — 数据库初始化脚本
-- ====================================================================
-- 数据库: PostgreSQL (兼容 Supabase)
-- 说明: 按顺序执行以下所有 SQL，完成建表 + 种子数据
-- 执行方式:
--   1. Supabase SQL Editor 直接执行
--   2. psql 命令行: psql -U <user> -d <db> -f database-init.sql
-- ====================================================================

-- ==================== 001_create_shops.sql ====================
-- 店铺表（多租户基础表）

CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  address VARCHAR(500) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  logo_url VARCHAR(500) DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shops_status ON shops(status);

COMMENT ON TABLE shops IS '店铺表';
COMMENT ON COLUMN shops.id IS '店铺唯一标识';
COMMENT ON COLUMN shops.name IS '店铺名称';
COMMENT ON COLUMN shops.description IS '店铺描述';
COMMENT ON COLUMN shops.address IS '店铺地址';
COMMENT ON COLUMN shops.phone IS '联系电话';
COMMENT ON COLUMN shops.logo_url IS '店铺 Logo URL';
COMMENT ON COLUMN shops.status IS '营业状态: open=营业中, closed=已关闭';


-- ==================== 002_create_categories.sql ====================
-- 菜品分类表

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  icon_key VARCHAR(50) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_shop_id ON categories(shop_id);
CREATE INDEX idx_categories_sort ON categories(shop_id, sort_order);

COMMENT ON TABLE categories IS '菜品分类表';
COMMENT ON COLUMN categories.id IS '分类唯一标识';
COMMENT ON COLUMN categories.shop_id IS '所属店铺 ID';
COMMENT ON COLUMN categories.name IS '分类名称（纯文本，如：招牌推荐、烤肉类）';
COMMENT ON COLUMN categories.sort_order IS '排序序号（升序排列）';
COMMENT ON COLUMN categories.icon_key IS '图标 key，由前端映射为图标展示（如：star, meat, vegetable）';


-- ==================== 003_create_menu_items.sql ====================
-- 菜品表

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  image_url VARCHAR(500) DEFAULT '',
  description TEXT DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  sales_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_items_shop_id ON menu_items(shop_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_status ON menu_items(shop_id, status);

COMMENT ON TABLE menu_items IS '菜品表';
COMMENT ON COLUMN menu_items.id IS '菜品唯一标识';
COMMENT ON COLUMN menu_items.shop_id IS '所属店铺 ID';
COMMENT ON COLUMN menu_items.category_id IS '所属分类 ID';
COMMENT ON COLUMN menu_items.name IS '菜品名称';
COMMENT ON COLUMN menu_items.price IS '价格（单位：分）';
COMMENT ON COLUMN menu_items.image_url IS '菜品图片 URL';
COMMENT ON COLUMN menu_items.description IS '菜品描述';
COMMENT ON COLUMN menu_items.status IS '状态: active=上架, inactive=下架';
COMMENT ON COLUMN menu_items.sales_count IS '累计销量';


-- ==================== 004_create_spec_groups.sql ====================
-- 规格组表（如：口味、份量）

CREATE TABLE IF NOT EXISTS spec_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  max_select INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spec_groups_shop_id ON spec_groups(shop_id);

COMMENT ON TABLE spec_groups IS '规格组表';
COMMENT ON COLUMN spec_groups.id IS '规格组唯一标识';
COMMENT ON COLUMN spec_groups.shop_id IS '所属店铺 ID';
COMMENT ON COLUMN spec_groups.name IS '规格组名称（如：口味、份量）';
COMMENT ON COLUMN spec_groups.is_required IS '是否必选';
COMMENT ON COLUMN spec_groups.max_select IS '最多可选数量';


-- ==================== 005_create_spec_options.sql ====================
-- 规格选项表（如：微辣/中辣/特辣，小份/大份）

CREATE TABLE IF NOT EXISTS spec_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_group_id UUID NOT NULL REFERENCES spec_groups(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_adjust INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spec_options_group_id ON spec_options(spec_group_id);

COMMENT ON TABLE spec_options IS '规格选项表';
COMMENT ON COLUMN spec_options.id IS '规格选项唯一标识';
COMMENT ON COLUMN spec_options.spec_group_id IS '所属规格组 ID';
COMMENT ON COLUMN spec_options.name IS '选项名称（如：微辣、小份）';
COMMENT ON COLUMN spec_options.price_adjust IS '价格调整（单位：分，可为负数）';
COMMENT ON COLUMN spec_options.is_default IS '是否为默认选项';


-- ==================== 006_create_orders.sql ====================
-- 订单主表

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment', 'paid', 'accepted',
      'preparing', 'delivering', 'completed',
      'cancelled', 'rejected'
    )),
  total INTEGER NOT NULL CHECK (total >= 0),
  delivery_type VARCHAR(20) NOT NULL
    CHECK (delivery_type IN ('delivery', 'pickup', 'dine_in')),
  address VARCHAR(500) DEFAULT '',
  table_no VARCHAR(50) DEFAULT '',
  remark TEXT DEFAULT '',
  contact_name VARCHAR(100) DEFAULT '',
  contact_phone VARCHAR(50) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_shop_id ON orders(shop_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(shop_id, status);
CREATE INDEX idx_orders_created ON orders(shop_id, created_at DESC);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.id IS '订单唯一标识';
COMMENT ON COLUMN orders.shop_id IS '所属店铺 ID';
COMMENT ON COLUMN orders.user_id IS '顾客用户 ID（微信 openid）';
COMMENT ON COLUMN orders.status IS '订单状态: pending_payment=待支付, paid=已支付, accepted=已接单, preparing=制作中, delivering=配送中, completed=已完成, cancelled=已取消, rejected=已拒绝';
COMMENT ON COLUMN orders.total IS '订单总金额（单位：分）';
COMMENT ON COLUMN orders.delivery_type IS '配送方式: delivery=外卖配送, pickup=到店自取, dine_in=堂食';
COMMENT ON COLUMN orders.address IS '配送地址（外卖配送时需填写）';
COMMENT ON COLUMN orders.table_no IS '桌号（堂食时使用）';
COMMENT ON COLUMN orders.remark IS '顾客备注';


-- ==================== 007_create_order_items.sql ====================
-- 订单明细表

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price INTEGER NOT NULL CHECK (price >= 0),
  spec_desc VARCHAR(500) DEFAULT '',
  image_url VARCHAR(500) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

COMMENT ON TABLE order_items IS '订单明细表';
COMMENT ON COLUMN order_items.id IS '明细唯一标识';
COMMENT ON COLUMN order_items.order_id IS '所属订单 ID';
COMMENT ON COLUMN order_items.menu_item_id IS '菜品 ID';
COMMENT ON COLUMN order_items.name IS '菜品名称（下单时快照）';
COMMENT ON COLUMN order_items.quantity IS '数量';
COMMENT ON COLUMN order_items.price IS '单价（单位：分）';
COMMENT ON COLUMN order_items.spec_desc IS '所选规格描述（如：微辣、大份）';
COMMENT ON COLUMN order_items.image_url IS '菜品图片（下单时快照）';


-- ==================== 008_create_delivery_info.sql ====================
-- 配送信息表

CREATE TABLE IF NOT EXISTS delivery_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL
    CHECK (type IN ('delivery', 'pickup', 'dine_in')),
  address VARCHAR(500) DEFAULT '',
  table_no VARCHAR(50) DEFAULT '',
  contact_name VARCHAR(100) DEFAULT '',
  contact_phone VARCHAR(50) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_delivery_info_order_id ON delivery_info(order_id);

COMMENT ON TABLE delivery_info IS '配送信息表';
COMMENT ON COLUMN delivery_info.id IS '配送信息唯一标识';
COMMENT ON COLUMN delivery_info.order_id IS '所属订单 ID';
COMMENT ON COLUMN delivery_info.type IS '配送方式: delivery=外卖配送, pickup=到店自取, dine_in=堂食';
COMMENT ON COLUMN delivery_info.address IS '配送地址';
COMMENT ON COLUMN delivery_info.table_no IS '桌号';


-- ==================== 009_create_promotions.sql ====================
-- 活动优惠表（P1 预留）

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL
    CHECK (type IN ('full_discount', 'first_order', 'coupon')),
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  rule JSONB NOT NULL DEFAULT '{}',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promotions_shop_id ON promotions(shop_id);
CREATE INDEX idx_promotions_status ON promotions(shop_id, status);

COMMENT ON TABLE promotions IS '活动优惠表（P1 预留）';
COMMENT ON COLUMN promotions.id IS '活动唯一标识';
COMMENT ON COLUMN promotions.shop_id IS '所属店铺 ID';
COMMENT ON COLUMN promotions.type IS '活动类型: full_discount=满减, first_order=首单立减, coupon=优惠券';
COMMENT ON COLUMN promotions.rule IS '活动规则（JSON，如：{"minAmount": 3000, "discount": 500}）';
COMMENT ON COLUMN promotions.status IS '状态: active=进行中, inactive=未激活, expired=已过期';


-- ==================== 010_rls_policies.sql ====================
-- Supabase Row Level Security 行级安全策略

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- shops
CREATE POLICY "shops_select_all" ON shops FOR SELECT USING (status = 'open');
CREATE POLICY "shops_insert_admin" ON shops FOR INSERT WITH CHECK (auth.role() = 'admin');
CREATE POLICY "shops_update_admin" ON shops FOR UPDATE USING (auth.role() = 'admin');

-- categories
CREATE POLICY "categories_select_all" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_admin" ON categories FOR ALL USING (
  auth.role() = 'admin' AND shop_id = (auth.jwt()->>'shop_id')::uuid
);

-- menu_items
CREATE POLICY "menu_items_select_all" ON menu_items FOR SELECT USING (status = 'active');
CREATE POLICY "menu_items_admin" ON menu_items FOR ALL USING (
  auth.role() = 'admin' AND shop_id = (auth.jwt()->>'shop_id')::uuid
);

-- spec_groups
CREATE POLICY "spec_groups_select_all" ON spec_groups FOR SELECT USING (true);
CREATE POLICY "spec_groups_admin" ON spec_groups FOR ALL USING (
  auth.role() = 'admin' AND shop_id = (auth.jwt()->>'shop_id')::uuid
);

-- spec_options
CREATE POLICY "spec_options_select_all" ON spec_options FOR SELECT USING (true);
CREATE POLICY "spec_options_admin" ON spec_options FOR ALL USING (
  auth.role() = 'admin' AND spec_group_id IN (
    SELECT id FROM spec_groups WHERE shop_id = (auth.jwt()->>'shop_id')::uuid
  )
);

-- orders
CREATE POLICY "orders_select_customer" ON orders FOR SELECT USING (
  auth.role() = 'customer' AND user_id = auth.jwt()->>'sub'
);
CREATE POLICY "orders_select_admin" ON orders FOR SELECT USING (
  auth.role() = 'admin' AND shop_id = (auth.jwt()->>'shop_id')::uuid
);
CREATE POLICY "orders_insert_customer" ON orders FOR INSERT WITH CHECK (
  auth.role() = 'customer' AND user_id = auth.jwt()->>'sub'
);
CREATE POLICY "orders_update_admin" ON orders FOR UPDATE USING (
  auth.role() = 'admin' AND shop_id = (auth.jwt()->>'shop_id')::uuid
);

-- order_items
CREATE POLICY "order_items_select_customer" ON order_items FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE user_id = auth.jwt()->>'sub')
);
CREATE POLICY "order_items_select_admin" ON order_items FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE shop_id = (auth.jwt()->>'shop_id')::uuid)
);
CREATE POLICY "order_items_insert_customer" ON order_items FOR INSERT WITH CHECK (
  order_id IN (SELECT id FROM orders WHERE user_id = auth.jwt()->>'sub')
);

-- delivery_info
CREATE POLICY "delivery_info_select_owner" ON delivery_info FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE user_id = auth.jwt()->>'sub' OR shop_id = (auth.jwt()->>'shop_id')::uuid)
);

-- promotions
CREATE POLICY "promotions_select_active" ON promotions FOR SELECT USING (status = 'active');
CREATE POLICY "promotions_admin" ON promotions FOR ALL USING (
  auth.role() = 'admin' AND shop_id = (auth.jwt()->>'shop_id')::uuid


-- ====================================================================
-- seed.sql — 种子数据
-- ====================================================================

-- 1. 创建示例店铺
INSERT INTO shops (id, name, description, address, phone, logo_url, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '小买卖烧烤',
  '正宗东北烧烤，炭火烤制，香飘十里！开业十年老店，每晚爆满。特色烤羊排、秘制鸡翅，搭配冰镇啤酒，人生完美！',
  '北京市朝阳区美食街88号',
  '13800138000',
  'https://img.example.com/shop-logo.png',
  'open'
);

-- 2. 创建菜品分类
INSERT INTO categories (id, shop_id, name, sort_order, icon_key) VALUES
  ('c0010000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '招牌推荐', 0, 'star'),
  ('c0010000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '烤肉类', 1, 'meat'),
  ('c0010000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '素菜类', 2, 'vegetable'),
  ('c0010000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '酒水类', 3, 'drink'),
  ('c0010000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '主食类', 4, 'rice');

-- 3. 创建菜品规格组
INSERT INTO spec_groups (id, shop_id, name, is_required, max_select) VALUES
  ('sg000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '口味选择', true, 1),
  ('sg000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '份量选择', true, 1);

-- 4. 创建规格选项
INSERT INTO spec_options (id, spec_group_id, name, price_adjust, is_default) VALUES
  ('so000000-0000-0000-0000-000000000001', 'sg000000-0000-0000-0000-000000000001', '不辣', 0, true),
  ('so000000-0000-0000-0000-000000000002', 'sg000000-0000-0000-0000-000000000001', '微辣', 0, false),
  ('so000000-0000-0000-0000-000000000003', 'sg000000-0000-0000-0000-000000000001', '中辣', 0, false),
  ('so000000-0000-0000-0000-000000000004', 'sg000000-0000-0000-0000-000000000001', '特辣', 0, false),
  ('so000000-0000-0000-0000-000000000005', 'sg000000-0000-0000-0000-000000000002', '小份', 0, true),
  ('so000000-0000-0000-0000-000000000006', 'sg000000-0000-0000-0000-000000000002', '大份', 500, false);

-- 5. 创建菜品
INSERT INTO menu_items (id, shop_id, category_id, name, price, description, sales_count, status) VALUES
  -- 招牌推荐
  ('mi000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000001', '秘制烤羊排', 6800, '精选内蒙古羊排，经12小时秘制酱料腌制，炭火慢烤至外焦里嫩，搭配特调蘸料，回味无穷！', 188, 'active'),
  ('mi000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000001', '招牌烤鸡翅', 1800, '奥尔良风味鸡翅，蜂蜜刷面，外酥里嫩，甜香可口，每桌必点！', 256, 'active'),
  ('mi000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000001', '烤鱿鱼须', 2200, '新鲜鱿鱼须，炭火快烤，Q弹有嚼劲，撒上芝麻孜然，香气扑鼻。', 167, 'active'),
  -- 烤肉类
  ('mi000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000002', '炭烤牛肉串', 3000, '新鲜牛里脊切块，炭火慢烤，肉汁饱满，孜然飘香。', 320, 'active'),
  ('mi000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000002', '香辣羊肉串', 2500, '内蒙古羊腿肉，手工切串，秘制辣椒粉腌制，炭烤至焦香。', 280, 'active'),
  ('mi000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000002', '蜜汁烤排骨', 3500, '猪肋排蜜汁腌制4小时，炭火慢烤至骨肉分离，甜香入味。', 156, 'active'),
  ('mi000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000002', '烤鸡胗', 1500, '新鲜鸡胗，口感脆嫩，配以孜然辣椒面，下酒好菜。', 134, 'active'),
  ('mi000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000002', '烤大虾', 4500, '鲜活大虾开背去虾线，蒜蓉粉丝垫底，鲜美无比。', 98, 'active'),
  -- 素菜类
  ('mi000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000003', '蒜蓉烤茄子', 800, '整根茄子炭火烤软，剖开铺满蒜蓉辣椒，软糯入味。', 198, 'active'),
  ('mi000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000003', '锡纸金针菇', 600, '金针菇配蒜蓉辣椒，锡纸包裹烤制，鲜嫩多汁。', 175, 'active'),
  ('mi000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000003', '烤韭菜', 500, '新鲜韭菜，刷油撒料，炭火快速烤制，烧烤经典素菜。', 143, 'active'),
  ('mi000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000003', '烤土豆片', 400, '土豆切厚片，双面烤至金黄，外脆里糯。', 120, 'active'),
  ('mi000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000003', '烤玉米', 1000, '甜玉米整根炭火烤制，刷黄油蜂蜜，香甜可口。', 88, 'active'),
  -- 酒水类
  ('mi000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000004', '可乐', 500, '冰镇可口可乐，夏日必备。', 400, 'active'),
  ('mi000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000004', '雪碧', 500, '冰镇雪碧，透心凉。', 350, 'active'),
  ('mi000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000004', '青岛啤酒', 800, '冰镇青岛啤酒，清爽纯正。', 350, 'active'),
  ('mi000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000004', '矿泉水', 300, '农夫山泉矿泉水。', 200, 'active'),
  ('mi000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000004', '酸梅汤', 600, '秘制酸梅汤，冰镇解腻，吃烧烤绝配。', 280, 'active'),
  -- 主食类
  ('mi000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000005', '烤冷面', 1000, '东北特色烤冷面，加鸡蛋加肠，酸甜酱料，正宗街边味道。', 120, 'active'),
  ('mi000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000005', '烤馒头片', 400, '手工馒头切厚片，炭火烤至外酥里软，抹上蒜蓉酱。', 90, 'active'),
  ('mi000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000005', '烤面包片', 600, '吐司面包刷蜂蜜黄油，烤至表面焦黄，香甜酥脆。', 75, 'active');
