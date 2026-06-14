-- 006_create_orders.sql
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

-- 索引
CREATE INDEX idx_orders_shop_id ON orders(shop_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(shop_id, status);
CREATE INDEX idx_orders_created ON orders(shop_id, created_at DESC);

-- 注释
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
