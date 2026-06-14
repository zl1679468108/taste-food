-- 004_create_spec_groups.sql
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

-- 索引
CREATE INDEX idx_spec_groups_shop_id ON spec_groups(shop_id);

-- 注释
COMMENT ON TABLE spec_groups IS '规格组表';
COMMENT ON COLUMN spec_groups.id IS '规格组唯一标识';
COMMENT ON COLUMN spec_groups.shop_id IS '所属店铺 ID';
COMMENT ON COLUMN spec_groups.name IS '规格组名称（如：口味、份量）';
COMMENT ON COLUMN spec_groups.is_required IS '是否必选';
COMMENT ON COLUMN spec_groups.max_select IS '最多可选数量';
