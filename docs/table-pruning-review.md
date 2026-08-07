# 表需求审查：可砍掉的伪需求 / 低价值表

> 审查日期：2026-08-05
> 范围：`tf_` 前缀 28 张表（本项目在 Supabase public schema 的实际表）
> 方法：
> 1. 对照 `docs/prd.md`（v1.0.5，全功能 done）逐表核对功能归属
> 2. 对全部 28 张 `tf_` 表在 `server/src`、`shared/src`、`admin/src`、`client/src` 做源码引用 Grep
> 3. 结论：**2 张表在全仓代码零引用（死表）**，其余 26 张均有对应已上线功能

---

## 一、建议砍掉（确凿死表 / 伪需求）

### 1. `tf_refresh_tokens`
- **原因**：PRD §5.1 明确标注 `[Legacy]`——"1.0.1 起主路径不再写入"；本次全仓代码 Grep 零引用。
- **历史**：双 Token 会话已统一由 `tf_user_sessions` 承载（Access + Refresh 的 hash 都存 `tf_user_sessions`，PRD §2.4 / §4.1）。该表是早期 JWT 方案的残留。
- **影响**：无任何运行时读写依赖，`DROP` 安全。
- **处置**：`DROP TABLE IF EXISTS tf_refresh_tokens;`

### 2. `tf_item_sales`
- **原因**：全仓代码 Grep 零引用；菜品销量统计已由 `tf_menu_items.monthly_sales` 字段 + `GET /api/menu-items/popular`（热门排行）覆盖，这张"菜品销售明细"预聚合表**从未被任何服务接线**。
- **影响**：无任何运行时读写依赖，`DROP` 安全。
- **处置**：`DROP TABLE IF EXISTS tf_item_sales;`

---

## 二、历史先例（佐证本项目已有"砍伪需求"的决策风格）

- `tf_customer_tags`、`tf_customer_tag_relations`：2026-08-04 判为伪需求，`v36` 迁移 drop（见 PRD §3.25）。理由：线下小餐饮店手动打标 ROI 低、徒增学习成本。
- 说明：这两张表已不在当前 28 张 `tf_` 表内（已删除），此处列出仅作决策一致性参考。

---

## 三、已上线但业务价值偏低（可讨论，**不建议盲目砍**，砍会损功能）

| 表 | 对应 PRD 功能 | 砍掉的风险 |
|----|--------------|-----------|
| `tf_audit_logs` | 平台操作审计（§3.16 / §4.11） | 平台治理/合规能力缺失 |
| `tf_export_jobs` | 导出中心（§3.21 / §4.4） | 已上线的异步导出功能失效 |
| `tf_favorites` | 菜品收藏 P3（§3.5 / T47） | 收藏与"收藏页一键加购"失效 |
| `tf_daily_stats` | 看板预聚合统计（§8.2.4） | 看板统计需改走实时聚合 |
| `tf_delivery_tracks` | 骑手配送轨迹（§3.17 / §4.12） | 骑手端地图/实时位置能力失效 |

> 这些表都对应 PRD 中**已上线（done）**的功能，删除会破坏现有演示/生产能力。除非你明确要"最小内核"，否则保留。

---

## 四、保留（核心业务，26 张活跃表）

| 表 | 功能 |
|----|------|
| `tf_shops` | 店铺 |
| `tf_categories` | 分类 |
| `tf_menu_items` | 菜品 |
| `tf_spec_groups` / `tf_spec_options` | 规格组 / 规格选项 |
| `tf_orders` / `tf_order_items` / `tf_order_status_history` | 订单 / 订单项 / 状态历史 |
| `tf_delivery_info` / `tf_delivery_tracks` | 配送凭证 / 配送轨迹 |
| `tf_promotions` | 促销 |
| `tf_users` / `tf_user_sessions` / `tf_user_roles` | 用户 / 会话 / 多角色 |
| `tf_role_applications` | 商家/骑手申请审批 |
| `tf_payments` | 支付记录 |
| `tf_favorites` | 收藏 |
| `tf_daily_stats` | 每日统计 |
| `tf_addresses` | 顾客地址簿 |
| `tf_audit_logs` | 操作审计 |
| `tf_shop_tables` | 堂食桌台 |
| `tf_reviews` | 订单评价 |
| `tf_media_assets` | 门店图库素材 |
| `tf_export_jobs` | 批量导出任务 |
| `tf_notifications` | 系统站内通知 |
| `tf_messages` | 商家→顾客站内信 |

---

## 五、执行建议

- **仅 `tf_refresh_tokens`、`tf_item_sales` 可安全 DROP**（零引用死表）。
- 拟迁移脚本：`docs/migrations/v38-drop-dead-tables.sql`（幂等 `DROP ... IF EXISTS`）。
- 执行流程（与 v35/v36 一致）：经 Management API `POST /v1/projects/{ref}/database/query`（PAT）apply。
- **需先确认**：DROP 为破坏性操作，建议先在 dev 库验证、再生产 apply；确认后由我执行。
