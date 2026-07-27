-- v15.0 账号体系：merchant 角色 / 密码登录 / 多角色 / 申请 / 站内消息
-- ---------------------------------------------------------------------------

-- 扩展用户表字段（兼容已有库）
ALTER TABLE "tf_users" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "tf_users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "tf_users" ADD COLUMN IF NOT EXISTS "phone" text;

-- 放宽 openid：密码账号可用合成 openid（pwd_username）
-- 角色 CHECK 升级为含 merchant（Postgres 需 drop 旧 constraint 名未知时用 DO 块）
DO $$
BEGIN
  -- 尝试删除 role 上的 check 约束后重建
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tf_users' AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%role%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE tf_users DROP CONSTRAINT ' || quote_ident(constraint_name)
      FROM information_schema.table_constraints
      WHERE table_name = 'tf_users' AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%role%'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'drop role check skipped: %', SQLERRM;
END $$;

ALTER TABLE "tf_users" DROP CONSTRAINT IF EXISTS tf_users_role_check;
ALTER TABLE "tf_users" ADD CONSTRAINT tf_users_role_check
  CHECK (role IN ('customer', 'admin', 'rider', 'merchant'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
  ON tf_users (username) WHERE username IS NOT NULL AND username <> '';

-- 一店一商家：同一 shop_id 仅允许一个激活 merchant（用户表当前角色）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_one_merchant_per_shop
  ON tf_users (shop_id) WHERE role = 'merchant' AND shop_id IS NOT NULL;

-- 多角色表
CREATE TABLE IF NOT EXISTS "tf_user_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES tf_users(id) ON DELETE CASCADE,
  "role" text NOT NULL CHECK (role IN ('customer', 'admin', 'rider', 'merchant')),
  "shop_id" uuid REFERENCES tf_shops(id) ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_user_roles" DISABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique
  ON tf_user_roles (user_id, role, COALESCE(shop_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON tf_user_roles(user_id);

-- 角色申请
CREATE TABLE IF NOT EXISTS "tf_role_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES tf_users(id) ON DELETE CASCADE,
  "apply_role" text NOT NULL CHECK (apply_role IN ('merchant', 'rider')),
  "status" text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  "shop_name" text,
  "shop_address" text,
  "shop_phone" text,
  "contact_name" text,
  "contact_phone" text,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "reject_reason" text,
  "reviewer_id" uuid,
  "reviewed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_role_applications" DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_role_apps_user ON tf_role_applications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_apps_status ON tf_role_applications(status, created_at DESC);
-- 同一用户同一申请角色仅一条 pending
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_apps_one_pending
  ON tf_role_applications (user_id, apply_role) WHERE status = 'pending';

-- 站内消息
CREATE TABLE IF NOT EXISTS "tf_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES tf_users(id) ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "related_type" text,
  "related_id" text,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz DEFAULT now()
);
ALTER TABLE "tf_notifications" DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON tf_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON tf_notifications(user_id, is_read);

-- 种子：测试商家（绑定默认店 小买卖烧烤）
-- 密码明文 merchant123（仅开发）；hash 由服务端 seed 接口或下方占位，实际以服务端 scrypt 写入为准
INSERT INTO tf_users (id, openid, username, password_hash, role, shop_id, nick_name, phone)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'pwd_merchant_demo',
  'merchant',
  'SEED_PENDING',
  'merchant',
  '00000000-0000-0000-0000-000000000001',
  '测试商家',
  '13800000001'
) ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  shop_id = EXCLUDED.shop_id,
  nick_name = EXCLUDED.nick_name,
  username = COALESCE(tf_users.username, EXCLUDED.username);

INSERT INTO tf_user_roles (user_id, role, shop_id, status)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'merchant', '00000000-0000-0000-0000-000000000001', 'active'),
  ('b0000000-0000-0000-0000-000000000001', 'customer', NULL, 'active')
ON CONFLICT DO NOTHING;

-- 平台管理员保持 shop_id 空（若历史数据误绑了店，可手工清空）
-- UPDATE tf_users SET shop_id = NULL WHERE role = 'admin' AND openid LIKE 'mock_admin%';

