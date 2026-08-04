-- v31: 用户账号状态字段（T312.4）
--
-- 目标：把「用户管理」从「账号」升级为「管理」，需要禁用/启用/拉黑等管理动作。
-- 本轮只加字段与默认值，不接管理动作（变更动作放 §3.25 跟进）。
--
-- 状态语义：
--   active    — 正常账号（默认）
--   disabled  — 被管理员禁用，禁登录/禁刷新（详见 §3.25）
--   banned    — 商家拉黑（仅商家视角可见，禁止在该店下单；§3.25 跟进动作）
--
-- ALL IF NOT EXISTS，可重复执行。

ALTER TABLE "tf_users"
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'banned'));

-- 现状全为 active，无需 UPDATE。索引留给查询使用（被禁账号列表/筛选）。
CREATE INDEX IF NOT EXISTS idx_users_status
  ON tf_users(status);

COMMENT ON COLUMN tf_users.status IS
  '账号状态：active=正常 / disabled=禁用（禁登录） / banned=拉黑（商家黑名单，§3.25 跟进）';
