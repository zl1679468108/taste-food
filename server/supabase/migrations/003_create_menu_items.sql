-- 003_create_menu_items.sql
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

-- 索引
CREATE INDEX idx_menu_items_shop_id ON menu_items(shop_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_status ON menu_items(shop_id, status);

-- 注释
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
