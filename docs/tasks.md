# 小买卖点餐系统 — 任务看板

> **关联文档**：`docs/prd.md`（需求）｜**归档**：`docs/archive/tasks-archive-*.md`（已完成任务）
>
> 状态约定：`todo` → `in_progress` → `done` ｜ 每个任务必须标注 `§` 关联到 PRD 章节。
>
> 完成日期：`done YYYY-MM-DD` ｜ 子任务 `TX.N` 全部 `done` 后，PRD 对应功能标记 ✅ 并补完成日期。

---

## 进行中（in_progress）

（无）

## 待办（todo）

| ID | 任务 | 模块 | PRD | 备注 |
|----|------|------|-----|------|
| T318 | 站内信双向沟通（顾客↔商家会话） | user | §3.25 | 当前站内信仅商家→顾客单向，无顾客侧接口、小程序无收件箱；需扩成双向会话 |
| T318.1 | 后端：顾客侧站内信接口（收件箱 + 发送/回复） | user | §3.25 | 新增 `@Roles(CUSTOMER)` 接口复用 `tf_messages`，from/to 方向互换；数据范围绑定顾客 `user_id`；非本店会话拒（400） |
| T318.2 | 后端：顾客读取时回写 `read_at` | user | §3.25 | 替换当前"商家手动 markRead"语义；顾客打开消息即标记已读 |
| T318.3 | 小程序：站内信收件箱 / 会话页（列表 + 详情 + 回复） | client | §3.25 | 当前 `client/src` 无任何站内信代码，需从零建；读取时调已读接口 |
| T318.4 | PC 后台：顾客消息进站与双向会话视图 | admin | §3.25 | 商家能看到顾客回复并回复，打通双向闭环 |
| T318.5 | 联调验证（dev 真实数据） | — | §3.25 | 双向收发 + 已读状态正确 |

## 暂缓 / 跟进

（无）

---

## 最近完成（最近 1 周完成的任务摘要归档于此，旧完成项见 docs/archive/）

| ID | 任务 | 完成日期 | 备注 |
|----|------|---------|------|
| T317 | 订单状态 count 聚合接口与 SQL 优化 | 2026-08-04 | v34：后端新增 `count_orders_by_scope` RPC + `v34-order-counts-perf.sql` 复合索引；前端 useOrderStatusBadges 拉取单次聚合结果。后端原 `GET /api/orders/counts` 接口已移除（v36），counts 合并入 `GET /api/orders` 的 `data.counts`；前端 hook 改为消费 list 返回的 counts；v34 索引继续支撑 list 接口的内部 count 聚合 |
| T316 | 订单列表状态标签加数字角标 | 2026-08-04 | GET /api/orders 同一接口返回 counts；PostgreSQL 单条聚合 count_orders_by_scope；前端 Tab 展示数字角标；生产 Supabase 已 apply v33-order-status-counts.sql（count_orders_by_scope RPC，2026-08-04） |
| T246.6 | 写 prd.md §3.23「到店核销流程闭环」 | 2026-08-03 | 文档先行；含流程对比表/触点/验收标准/API 表 |
| T246.7 | 后端核销接口 `POST /api/orders/:id/verify` | 2026-08-03 | 仅商家+店铺归属校验；`ready_for_pickup → completed`；已完成为 409 幂等；附 7 条单测（订单-order-pickup-verify.test.ts） |
| T246.8 | 下单页自取/堂食移除联系人/手机号 | 2026-08-03 | 含堂食；不影响外卖分支（外卖仍保留联系人）；提交体对自取/堂食传空串向后兼容 |
| T246.9 | 订单详情：取餐码卡改为仅二维码 | 2026-08-03 | 新增 `GET /api/orders/:id/qrcode` 后端 PNG 端点；前端点击缩略图放大；自取/堂食展示；已去除文字码（报号） |
| T246.10 | PC 后台「到店核销」中心 `/merchant/pickup` | 2026-08-03 | 待取餐列表 + 扫码（BarcodeDetector 降级输入框）+ 输码核销；路由 + canMerchant 权限接入 |
| T312.1 | 用户详情抽屉（共用） | 2026-08-03 | 点行展开抽屉；展示画像+审计 5 条；动线不动编辑 |
| T312.2 | 用户画像 API `GET /api/users/:id/profile` | 2026-08-03 | 基础资料+全角色+状态+按角色业务聚合（4 套）+ 审计摘要 |
| T312.3 | 抽屉按角色渲染画像 | 2026-08-03 | 顾客/商家/骑手/管理员四套卡片；空值降级（已并入 T312.1 组件） |
| T312.5 | 列表筛选增强 | 2026-08-03 | 状态筛选（filter2）+ 注册时间范围（extra Select）+ 手机号关键词 |
| T312.6 | 详情页最近订单跳转 | 2026-08-03 | 顾客画像「最近下单」点击进 `/merchant/orders?userId=...` |
| T312.12 | 双入口命名：平台=用户管理 / 商家=顾客管理 | 2026-08-03 | routes.ts 加 `/platform/user`(用户管理)+`/merchant/user` 改名顾客管理；页面标题按角色切换 |
| T313.1 | 商家顾客列表 API `GET /api/merchant/customers` | 2026-08-03 | 仅 MERCHANT；本店顾客（曾下单用户）聚合订单数/累计消费/客单价/最近下单；关键词+排序+时间窗口 |
| T313.2 | 商家顾客画像 API `GET /api/merchant/customers/:id/profile` | 2026-08-03 | 本店维度基本资料+统计+最近订单（含件数） |
| T313.3 | 前端 customer service + hook | 2026-08-03 | `services/customer.ts` + `useCustomerQueries.ts`（useShopCustomers/useShopCustomerProfile）；queryKeys 加 customers |
| T313.4 | 顾客管理列表页 `CustomerManagement` | 2026-08-03 | 表格：顾客/手机号/订单数/累计消费/客单价/最近下单/状态；搜索+排序+时间窗口；行点击开抽屉 |
| T313.5 | 顾客画像抽屉 `CustomerProfileDrawer` | 2026-08-03 | 本店维度画像卡 + 最近订单列表（只读）；复用 OrderStatusTag |
| T313.6 | 路由拆分：商家 `/merchant/user` → `CustomerManagement` 组件 | 2026-08-03 | 与平台 `User` 彻底分离；平台保留账号治理视角 |
| T313.7 | 顾客标签后端（CRUD + 分配） | 已移除 2026-08-04 | 伪需求，已彻底移除：后端代码删除 + `tf_customer_tags`/`tf_customer_tag_relations` 表 drop（迁移 v36）；顾客管理列表/画像保留 |
| T313.8 | 顾客标签前端（列/筛选/管理/分配） | 已移除 2026-08-04 | 伪需求，已彻底移除：列表标签列/筛选、TagManageModal、TagAssignModal 全部删除；顾客管理其余 UI 保留 |
| T313.9 | 站内信后端（商家→顾客） | 2026-08-03 | 新增 message.service/controller（注册进 UserModule）；tf_messages（v32）；发送（校验本店顾客）/发件箱/标记已读 |
| T314 | 站内信前端 | 2026-08-03 | 抽屉「发送站内信」→ MessageModal：历史列表 + textarea 发送 + 已读/未读状态 |
| T315 | 移除 Dashboard 自定义区间展示标签 | 2026-08-04 | 保留 RangePicker；去除自定义区间蓝色 Tag |
| T312.4 | tf_users.status 字段 + v31 migration | 2026-08-03 | migration v31 + database-init.sql 列已加；线上 Supabase 待 apply |
| M-001 | 将待执行迁移 apply 到生产 Supabase | 2026-08-04 | 经 PAT + Management API `/v1/projects/{ref}/database/query` 落地 v29(voice_alert_config)/v30(get_today_stats RPC)/v31(tf_users.status)/v32(tf_customer_tags+tf_customer_tag_relations+tf_messages)；v36 已 drop 标签两张表（保留 tf_messages）；顾客管理/站内信可跑真实数据，标签子系统已移除 |
