-- v32: 顾客标签 + 站内信（§3.25 / T313.7-T313.9, T314）
--
-- 顾客标签：商家为本店顾客打标，用于分组运营（如「回头客」「VIP」「投诉」）。
-- 站内信：商家向本店顾客发送站内消息（顾客在微信小程序内读取，read_at 由小程序侧写入）。
--
-- 全部 IF NOT EXISTS，可重复执行。

-- ============================================================
-- 顾客标签定义（店铺级：每个店铺独立一套标签）
-- ============================================================
CREATE TABLE IF NOT EXISTS "tf_customer_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL REFERENCES tf_shops(id) ON DELETE CASCADE,
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#1677ff',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_customer_tags" DISABLE ROW LEVEL SECURITY;
-- 同一店铺标签名唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tags_shop_name
  ON tf_customer_tags(shop_id, name);
CREATE INDEX IF NOT EXISTS idx_customer_tags_shop
  ON tf_customer_tags(shop_id);

-- ============================================================
-- 顾客-标签关联（多对多）
-- ============================================================
CREATE TABLE IF NOT EXISTS "tf_customer_tag_relations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL REFERENCES tf_shops(id) ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES tf_users(id) ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES tf_customer_tags(id) ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_customer_tag_relations" DISABLE ROW LEVEL SECURITY;
-- 同一顾客同一标签仅一条
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tag_rel_uniq
  ON tf_customer_tag_relations(user_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_rel_shop_user
  ON tf_customer_tag_relations(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_rel_tag
  ON tf_customer_tag_relations(tag_id);

-- ============================================================
-- 站内信（商家 → 顾客）
-- ============================================================
CREATE TABLE IF NOT EXISTS "tf_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL REFERENCES tf_shops(id) ON DELETE CASCADE,
  "from_user_id" uuid NOT NULL REFERENCES tf_users(id) ON DELETE CASCADE,
  "to_user_id" uuid NOT NULL REFERENCES tf_users(id) ON DELETE CASCADE,
  "content" text NOT NULL,
  "read_at" timestamptz,
  "created_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_messages" DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_messages_shop_to_created
  ON tf_messages(shop_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_shop_created
  ON tf_messages(shop_id, created_at DESC);

COMMENT ON TABLE "tf_customer_tags" IS '商家为本店顾客定义的标签（店铺级，名称唯一）';
COMMENT ON TABLE "tf_customer_tag_relations" IS '顾客与标签的多对多关联';
COMMENT ON TABLE "tf_messages" IS '商家向顾客发送的站内信；read_at 由顾客在微信小程序侧读取时写入';
