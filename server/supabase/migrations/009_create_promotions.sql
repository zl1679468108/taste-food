-- 009_create_promotions.sql
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

-- 索引
CREATE INDEX idx_promotions_shop_id ON promotions(shop_id);
CREATE INDEX idx_promotions_status ON promotions(shop_id, status);

-- 注释
COMMENT ON TABLE promotions IS '活动优惠表（P1 预留）';
COMMENT ON COLUMN promotions.id IS '活动唯一标识';
COMMENT ON COLUMN promotions.shop_id IS '所属店铺 ID';
COMMENT ON COLUMN promotions.type IS '活动类型: full_discount=满减, first_order=首单立减, coupon=优惠券';
COMMENT ON COLUMN promotions.rule IS '活动规则（JSON，如：{"minAmount": 3000, "discount": 500}）';
COMMENT ON COLUMN promotions.status IS '状态: active=进行中, inactive=未激活, expired=已过期';
