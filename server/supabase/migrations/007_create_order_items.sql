-- 007_create_order_items.sql
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

-- 索引
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- 注释
COMMENT ON TABLE order_items IS '订单明细表';
COMMENT ON COLUMN order_items.id IS '明细唯一标识';
COMMENT ON COLUMN order_items.order_id IS '所属订单 ID';
COMMENT ON COLUMN order_items.menu_item_id IS '菜品 ID';
COMMENT ON COLUMN order_items.name IS '菜品名称（下单时快照）';
COMMENT ON COLUMN order_items.quantity IS '数量';
COMMENT ON COLUMN order_items.price IS '单价（单位：分）';
COMMENT ON COLUMN order_items.spec_desc IS '所选规格描述（如：微辣、大份）';
COMMENT ON COLUMN order_items.image_url IS '菜品图片（下单时快照）';
