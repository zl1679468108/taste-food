-- 005_create_spec_options.sql
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

-- 索引
CREATE INDEX idx_spec_options_group_id ON spec_options(spec_group_id);

-- 注释
COMMENT ON TABLE spec_options IS '规格选项表';
COMMENT ON COLUMN spec_options.id IS '规格选项唯一标识';
COMMENT ON COLUMN spec_options.spec_group_id IS '所属规格组 ID';
COMMENT ON COLUMN spec_options.name IS '选项名称（如：微辣、小份）';
COMMENT ON COLUMN spec_options.price_adjust IS '价格调整（单位：分，可为负数）';
COMMENT ON COLUMN spec_options.is_default IS '是否为默认选项';
