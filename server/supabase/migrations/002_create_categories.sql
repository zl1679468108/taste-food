-- 002_create_categories.sql
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

-- 索引
CREATE INDEX idx_categories_shop_id ON categories(shop_id);
CREATE INDEX idx_categories_sort ON categories(shop_id, sort_order);

-- 注释
COMMENT ON TABLE categories IS '菜品分类表';
COMMENT ON COLUMN categories.id IS '分类唯一标识';
COMMENT ON COLUMN categories.shop_id IS '所属店铺 ID';
COMMENT ON COLUMN categories.name IS '分类名称（纯文本，如：招牌推荐、烤肉类）';
COMMENT ON COLUMN categories.sort_order IS '排序序号（升序排列）';
COMMENT ON COLUMN categories.icon_key IS '图标 key，由前端映射为图标展示（如：star, meat, vegetable）';
