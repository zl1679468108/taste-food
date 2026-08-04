# 项目长期记忆（taste-food / 小买卖）

## Dashboard「待处理」设计约定（2026-08-04 确立）
- **语义**：待处理 = 不限时间维度的积压待办，统计 `status IN ('paid','accepted')`，**不随**时间范围控件（今日/近7天/自定义）变化。
  - `paid` = 待接单（已支付待商家接单）
  - `accepted` = 待备餐（已接单待备餐）
- **与「今日统计」区分**：旧 `get_today_stats` 的 pending 是「今天创建的」待处理（受 UTC 日期过滤，且有凌晨时区失真），新待处理区改用独立接口，口径更稳定。
- **接口**：`GET /api/orders/stats/pending`（后端 `order.service.getPendingStats`，不限 created_at）。
- **前端**：`useDashboardQueries.useDashboardStats` 返回 `pendingStats`（`{paid,accepted,total}`），逐店 fan-out 合并（全店汇总=各店求和）。
- **布局**：`admin/src/components/DashboardPendingCard.tsx` 置于时间范围控件**上方**常驻区，拆「待接单 / 待备餐」两个可点击子项。
- **跳转**：点击 → `/merchant/order?status=paid|accepted`（订单页 `OrderStatusTabs` 已支持从 URL query 初始化筛选）。仅 `canMerchant` 可点击；平台管理员（`canPlatformAdmin` 且非商家）无订单页，仅展示数量。
- **已知坑**：`get_today_stats` RPC 用 `date_trunc('day', now())`（UTC）划分「今日」，北京时间 0-8 点会把当天单算作昨天，需要时可改成 `now() AT TIME ZONE 'Asia/Shanghai'`。

## Supabase 生产库连接事实（2026-08-04 探明）
- **项目 region = `ap-southeast-1`（新加坡）**。验证方式：对 6 个候选 region 的 `aws-0-<region>.pooler.supabase.com:6543` 探测，错 region 一律回 `tenant/user postgres.<ref> not found`，唯独 ap-southeast-1 认得本项目（但到新加坡链路偶发卡顿/被断）。
- **DDL 执行凭据要求（重要）**：连 Postgres（直连 5432 或池 6543）**必须用数据库密码**（Dashboard → Project Settings → Database 里的密码），**API key（anon/service_role）当不了 Postgres 密码**——官方文档确认 JWT 仅用于 Data API（REST/客户端库）。用 service_role key 当密码会 TLS 建好后立即 `Connection terminated unexpectedly`。
  - `server/.env.production` 只有 `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`，**没有数据库密码**，故不能直接 psql/pg 跑迁移。
- **本机出网走 HTTP 代理**：代理端口**动态**，从环境变量 `HTTPS_PROXY` 读取（2026-08-04 实测为 `http://127.0.0.1:58538`；更早一轮会话是 50447，已失效）。脚本里**不要写死端口**，应读 `process.env.HTTPS_PROXY`。`pg` 直连 TCP 不认代理，需自建「本地端口 → 代理 CONNECT 隧道」转发；但 Postgres 池到新加坡链路不稳。
- **Management API 可达且推荐用于 DDL**：正确端点是 `https://api.supabase.com/v1/projects/{ref}/database/query`（POST，body `{query:"<sql>"}`），**不是** `/sql`（`/sql` 会返回 `Cannot POST`）。直连或经代理均可（api.supabase.com 直连可达，返回 401 仅缺鉴权）。执行迁移走这条最稳，只需 **Supabase Personal Access Token (PAT)**（supabase.com → Account → Access Tokens 生成），无需暴露数据库密码。PAT 用完可在同页 Revoke 吊销。
- **迁移已 apply（M-001，2026-08-04 完成）**：用 PAT + `/database/query` 接口落地 `pending-v29-v30-apply.sql`(v29 `voice_alert_config` 列 / v30 `get_today_stats` RPC+索引) + `v31-users-status.sql`(`tf_users.status`) + `v32-customer-tags-and-messages.sql`(`tf_customer_tags`/`tf_customer_tag_relations`/`tf_messages`)。已逐对象验证落库；顾客管理/标签/站内信现已可跑真实数据，店铺设置保存不再因缺列报错。四个迁移文件均幂等可重跑。
- **apply 迁移的执行方式（二选一）**：
  1. 用户提供 PAT → 用 Management API `/v1/projects/{ref}/database/query` 跑（推荐，HTTPS 过代理最稳）。
  2. 用户提供数据库密码 → 用 pg 经代理隧道连 ap-southeast-1 池跑。
