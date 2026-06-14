-- 008_create_delivery_info.sql
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

-- 索引
CREATE UNIQUE INDEX idx_delivery_info_order_id ON delivery_info(order_id);

-- 注释
COMMENT ON TABLE delivery_info IS '配送信息表';
COMMENT ON COLUMN delivery_info.id IS '配送信息唯一标识';
COMMENT ON COLUMN delivery_info.order_id IS '所属订单 ID';
COMMENT ON COLUMN delivery_info.type IS '配送方式: delivery=外卖配送, pickup=到店自取, dine_in=堂食';
COMMENT ON COLUMN delivery_info.address IS '配送地址';
COMMENT ON COLUMN delivery_info.table_no IS '桌号';
