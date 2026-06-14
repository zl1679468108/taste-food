-- 001_create_shops.sql
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

-- 索引
CREATE INDEX idx_shops_status ON shops(status);

-- 注释
COMMENT ON TABLE shops IS '店铺表';
COMMENT ON COLUMN shops.id IS '店铺唯一标识';
COMMENT ON COLUMN shops.name IS '店铺名称';
COMMENT ON COLUMN shops.description IS '店铺描述';
COMMENT ON COLUMN shops.address IS '店铺地址';
COMMENT ON COLUMN shops.phone IS '联系电话';
COMMENT ON COLUMN shops.logo_url IS '店铺 Logo URL';
COMMENT ON COLUMN shops.status IS '营业状态: open=营业中, closed=已关闭';
