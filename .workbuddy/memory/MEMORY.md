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
- **时区口径（已用 v35 修正）**：统计「今日/趋势」一律按**北京时间（Asia/Shanghai）**划分。`get_today_stats` / `get_daily_stats` 两 RPC 的日期边界与分桶均用 `AT TIME ZONE 'Asia/Shanghai'`（原 v30 用 UTC，会导致北京时间 0-8 点把当天单算作昨天）。相关：`docs/migrations/v35-timezone-beijing.sql`（**已 apply 生产**，2026-08-04 用 PAT 落库并 verify）、`docs/database-init.sql`、`order.service.getTodayStats` 回退路径（Node 端也按 UTC+8 算「今日」）。

## Supabase 生产库连接事实（2026-08-04 探明）
- **项目 region = `ap-southeast-1`（新加坡）**。验证方式：对 6 个候选 region 的 `aws-0-<region>.pooler.supabase.com:6543` 探测，错 region 一律回 `tenant/user postgres.<ref> not found`，唯独 ap-southeast-1 认得本项目（但到新加坡链路偶发卡顿/被断）。
- **DDL 执行凭据要求（重要）**：连 Postgres（直连 5432 或池 6543）**必须用数据库密码**（Dashboard → Project Settings → Database 里的密码），**API key（anon/service_role）当不了 Postgres 密码**——官方文档确认 JWT 仅用于 Data API（REST/客户端库）。用 service_role key 当密码会 TLS 建好后立即 `Connection terminated unexpectedly`。
  - `server/.env.production` 只有 `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`，**没有数据库密码**，故不能直接 psql/pg 跑迁移。
- **本机出网走 HTTP 代理**：代理端口**动态**，从环境变量 `HTTPS_PROXY` 读取（2026-08-04 实测为 `http://127.0.0.1:58538`；更早一轮会话是 50447，已失效）。脚本里**不要写死端口**，应读 `process.env.HTTPS_PROXY`。`pg` 直连 TCP 不认代理，需自建「本地端口 → 代理 CONNECT 隧道」转发；但 Postgres 池到新加坡链路不稳。
- **Management API 可达且推荐用于 DDL**：正确端点是 `https://api.supabase.com/v1/projects/{ref}/database/query`（POST，body `{query:"<sql>"}`），**不是** `/sql`（`/sql` 会返回 `Cannot POST`）。直连或经代理均可（api.supabase.com 直连可达，返回 401 仅缺鉴权）。执行迁移走这条最稳，只需 **Supabase Personal Access Token (PAT)**（supabase.com → Account → Access Tokens 生成），无需暴露数据库密码。PAT 用完可在同页 Revoke 吊销。
- **PAT 本地存储（2026-08-04 用户要求「记住，以后常要执行 SQL」）**：用户提供的 PAT 已存于 `~/.workbuddy/supabase_pat.txt`（`chmod 600`，**位于项目 git 仓库之外**，避免 token 被 commit 泄露）。所有 apply/verify 脚本（`scripts/apply-*.mjs`、`scripts/verify-*.mjs`）统一从该文件读取 PAT（fallback 也认 `SUPABASE_PAT` 环境变量），不要再让用户重复粘贴。
- **迁移已 apply（M-001，2026-08-04 完成）**：用 PAT + `/database/query` 接口落地 `pending-v29-v30-apply.sql`(v29 `voice_alert_config` 列 / v30 `get_today_stats` RPC+索引) + `v31-users-status.sql`(`tf_users.status`) + `v32-customer-tags-and-messages.sql`(`tf_customer_tags`/`tf_customer_tag_relations`/`tf_messages`)。已逐对象验证落库；顾客管理/标签/站内信现已可跑真实数据，店铺设置保存不再因缺列报错。四个迁移文件均幂等可重跑。
- **apply 迁移的执行方式（二选一）**：
  1. 用户提供 PAT → 用 Management API `/v1/projects/{ref}/database/query` 跑（推荐，HTTPS 过代理最稳）。
  2. 用户提供数据库密码 → 用 pg 经代理隧道连 ap-southeast-1 池跑。

## Dashboard 路由与种子账号（2026-08-04 验收教训）
- **Dashboard 路由不是 `/dashboard`**，实际是：
  - `/platform/dashboard`（access=`canPlatformAdmin`，平台管理员）— `admin/config/routes.ts:12`
  - `/merchant/dashboard`（access=`canMerchant`，商家）— `routes.ts:19`
  - 测试/e2e 脚本直接 `goto('/dashboard')` 会触发 UMI 警告 `No routes matched location "/dashboard"`，路由出口为空、组件不渲染，表现为「白屏且无任何 stats 请求」。**以后验 dashboard 必须用正确路径**。
- **开发种子账号与 SEED_PENDING 激活**（`server/src/modules/auth/auth.service.ts:692-712`）：
  - `admin / admin123`（平台管理员；内存 seed 有 username+passwordHash='SEED_PENDING'，内存回退可登录）
  - `merchant / merchant123`（商家，绑 DEFAULT_SHOP_ID；**内存 seed 没设 username，需 Supabase 真表 `tf_users.username='merchant'` 才能登录**，首次登录会激活并把 `password_hash` 写回）
  - `rider / rider123`（骑手）
- **Playwright/Chromium 验 admin 的标准流程**（参考 `tests/shoot-merchant.mjs`）：
  1. `page.request.post('/api/auth/login')` 拿 token（绕过 antd 表单竞态）
  2. `page.evaluate` 注入 `localStorage`（`token` / `refreshToken` / `user`）
  3. `goto` 真实路由（`/platform/dashboard` 或 `/merchant/dashboard`）
  4. `sleep ≥ 50s` 等 stats/today + stats/daily + stats/pending 全 200 完成（单个 1-3s；react-query 全完才退出 loading）
  5. 截图。点击跳转验 `waitForURL('**/merchant/order**status=paid|accepted')` + Tab 激活
- **当前 dev 库真实数据**：1 单 paid + 10 单 accepted = 总待处理 11 单（用于演示「不限时间维度」与旧 `todayStats.pendingCount=0` 的对比，证明改造口径正确）。

## 订单 count 接口合并（v36，2026-08-04 晚）
- 用户要求：把数据列表的 data 和 count 集中在一个接口；count 按 status 拆分；删除独立 `/api/orders/counts?shop_id=...` 接口。
- **决定**：保留 list 接口已有的 `data.counts` 字段，删独立 counts 接口；前端 `useOrderStatusBadges` 改为接收 counts 入参（不再自己发请求），WS 新单订阅上移到 `admin/src/pages/Order/index.tsx`。
- 后端：`server/src/modules/order/order.controller.ts` 删除 `@Get('counts')`（原 211-249 行）；`GET /api/orders` 内部仍调用 `countOrdersByScope` 填 counts（不变）。
- 前端：
  - `admin/src/services/order.ts` 删除 `getOrderStatusCounts`；`getOrders` 返回类型 `counts` 收紧为**必填**。
  - `admin/src/pages/Order/hooks/useOrderStatusBadges.ts` 重写为纯函数 hook（`useMemo`，仅消费 counts 入参）。
  - `admin/src/pages/Order/index.tsx` 改调 + 新增 WS 新单订阅 useEffect（按 `shopId` 过滤，触发 `ordersQuery.refetch()`）。
- 索引：`v34-order-counts-perf.sql` 5 个索引**保留**（继续支撑 list 接口内嵌的 `count_orders_by_scope` 调用），注释略调为「被 GET /api/orders 内嵌调用」。
- 文档：`docs/tasks.md` T317 备注加 v36 回退说明；`docs/migrations/v34-order-counts-perf.sql` / `docs/database-init.sql` 注释里的接口名改为 list 内嵌。
- 验证：`server npx tsc --noEmit` 0 错；`admin npx tsc --noEmit` 0 错；`admin jest src/__tests__/order.test.ts` 6/6 通过。
- **DB 无迁移**（接口合并属于纯重构；索引继续服务于 list 接口内的 RPC 调用，无需新增/删除）。

## 订单 Tab 角标覆盖全部状态（v37，2026-08-04 晚）
- 用户反馈：v36 合并接口后 counts 没透到全部 Tab 上（之前 hook 用 BADGE_KEYS 只挑 4 个：`paid`/`ready_for_delivery`/`ready_for_pickup`/`refund`）。
- 决定：counts **全部 10 个状态**应用到 Tab 角标（不做人工挑选）；「全部」tab 显示 `counts.all`；薄包装 hook 一并删除。
- 改动：
  - **删除** `admin/src/pages/Order/hooks/useOrderStatusBadges.ts`（包括 `OrderStatusBadges` 类型）。
  - `OrderStatusTabs.tsx` props `badges?: OrderStatusBadges` → `counts?: OrderStatusCounts`（更准确）；renderLabel 按 `counts[key as keyof OrderStatusCounts]` 取值；首项 `key=''` 走 `counts.all`。
  - `Order/index.tsx` 直接 `counts={ordersQuery.data?.counts}`。
- 零值策略：`renderLabel` 在 `value <= 0` 时不渲染 Badge（避免噪声）。截图确认：「待支付 0」「待配送 0」不显示角标。
- 验证：`admin npx tsc --noEmit` 0 错；`admin jest src/__tests__/order.test.ts` 6/6；Playwright 跑 `tests/shoot-order-tabs.mjs` 截图：
  - 全部 39 / 已支付 1 / 已接单 10 / 制作中 1 / 待取餐 3 / 配送中 1 / 退款售后 11 / 已完成 12
  - 截图存 `test-results/order-tabs-all-badges.png` + `order-tabs-accepted.png`。
- 经验：v36 之后 hook 已退化为字段提取，转发逻辑薄到不应再独立包装；类型用 `OrderStatusCounts` 比 `Record<string, number>` 精确；遇到 0 跳过 `Badge` 避免视觉噪声。
