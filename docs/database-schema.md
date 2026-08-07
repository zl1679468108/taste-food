# 数据库真实结构（taste-food / tf_ 表）

> 生成时间：2026-08-05 ｜ 来源：生产 Supabase 库 `information_schema`（ref `fvggqgeiwewsjojargxe`）
> 字段的业务说明以 `docs/prd.md §5.1` 为准；本文档为**技术真实结构**（字段名 / 类型 / 约束），用于核对与 `docs/database-init.sql` 的漂移。
> 当前 tf_ 表共 **26** 张（2026-08-04 砍 `tf_customer_tags`/`tf_customer_tag_relations` v36；2026-08-05 砍 `tf_refresh_tokens`/`tf_item_sales` v38）。

## 表清单（26）

1. `tf_addresses`
2. `tf_audit_logs`
3. `tf_categories`
4. `tf_daily_stats`
5. `tf_delivery_info`
6. `tf_delivery_tracks`
7. `tf_export_jobs`
8. `tf_favorites`
9. `tf_media_assets`
10. `tf_menu_items`
11. `tf_messages`
12. `tf_notifications`
13. `tf_order_items`
14. `tf_order_status_history`
15. `tf_orders`
16. `tf_payments`
17. `tf_promotions`
18. `tf_reviews`
19. `tf_role_applications`
20. `tf_shop_tables`
21. `tf_shops`
22. `tf_spec_groups`
23. `tf_spec_options`
24. `tf_user_roles`
25. `tf_user_sessions`
26. `tf_users`

## 字段结构

### `tf_addresses`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `user_id` | text | 否 |  |  |
| `shop_id` | uuid | 是 |  | FK → tf_shops(id) |
| `contact_name` | text | 否 |  |  |
| `contact_phone` | text | 否 |  |  |
| `detail` | text | 否 |  |  |
| `tag` | text | 是 |  |  |
| `is_default` | boolean | 是 | false |  |
| `created_at` | timestamp with time zone | 是 | now() |  |
| `updated_at` | timestamp with time zone | 是 | now() |  |
| `latitude` | numeric | 是 |  |  |
| `longitude` | numeric | 是 |  |  |

### `tf_audit_logs`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 是 |  |  |
| `user_id` | text | 否 |  |  |
| `role` | text | 否 |  |  |
| `method` | text | 否 |  |  |
| `path` | text | 否 |  |  |
| `action` | text | 否 |  |  |
| `resource` | text | 是 |  |  |
| `resource_id` | text | 是 |  |  |
| `summary` | text | 是 | ''::text |  |
| `status_code` | integer | 是 |  |  |
| `ip` | text | 是 |  |  |
| `created_at` | timestamp with time zone | 是 | now() |  |

### `tf_categories`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 否 |  | FK → tf_shops(id) |
| `name` | character varying(255) | 否 |  |  |
| `sort_order` | integer | 否 | 0 |  |
| `icon_key` | character varying(50) | 是 | ''::character varying |  |
| `created_at` | timestamp with time zone | 否 | now() |  |
| `updated_at` | timestamp with time zone | 否 | now() |  |

### `tf_daily_stats`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 是 |  | FK → tf_shops(id) |
| `stat_date` | date | 否 |  |  |
| `total_orders` | integer | 是 | 0 |  |
| `total_revenue` | integer | 是 | 0 |  |
| `completed_orders` | integer | 是 | 0 |  |
| `cancelled_orders` | integer | 是 | 0 |  |
| `created_at` | timestamp with time zone | 是 | now() |  |
| `updated_at` | timestamp with time zone | 是 | now() |  |

### `tf_delivery_info`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `order_id` | uuid | 否 |  | FK → tf_orders(id) |
| `type` | character varying(20) | 否 | 'delivery'::character varying |  |
| `address` | character varying(500) | 是 | ''::character varying |  |
| `table_no` | character varying(50) | 是 | ''::character varying |  |
| `contact_name` | character varying(100) | 是 | ''::character varying |  |
| `contact_phone` | character varying(50) | 是 | ''::character varying |  |
| `created_at` | timestamp with time zone | 否 | now() |  |
| `updated_at` | timestamp with time zone | 否 | now() |  |
| `rider_id` | text | 是 |  |  |
| `proof_photos` | jsonb | 否 | '[]'::jsonb |  |
| `confirm_latitude` | numeric | 是 |  |  |
| `confirm_longitude` | numeric | 是 |  |  |
| `confirm_accuracy` | numeric | 是 |  |  |
| `confirm_distance_m` | numeric | 是 |  |  |
| `confirm_radius_m` | numeric | 是 |  |  |
| `confirm_source` | text | 是 | 'rider'::text |  |
| `force_reason` | text | 是 |  |  |
| `shop_id` | uuid | 是 |  |  |
| `delivered_at` | timestamp with time zone | 是 |  |  |
| `estimated_delivery_at` | timestamp with time zone | 是 |  |  |
| `courier_name` | text | 是 |  |  |
| `courier_phone` | text | 是 |  |  |

### `tf_delivery_tracks`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `order_id` | uuid | 否 |  | FK → tf_orders(id) |
| `shop_id` | uuid | 否 |  | FK → tf_shops(id) |
| `rider_id` | text | 是 |  |  |
| `latitude` | numeric | 否 |  |  |
| `longitude` | numeric | 否 |  |  |
| `speed` | numeric | 是 |  |  |
| `accuracy` | numeric | 是 |  |  |
| `source` | text | 是 | 'rider'::text |  |
| `recorded_at` | timestamp with time zone | 是 | now() |  |
| `created_at` | timestamp with time zone | 是 | now() |  |

### `tf_export_jobs`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 否 |  | FK → tf_shops(id) |
| `user_id` | uuid | 否 |  | FK → tf_users(id) |
| `entity` | text | 否 | 'orders'::text |  |
| `status` | text | 否 | 'pending'::text |  |
| `format` | text | 否 | 'xlsx'::text |  |
| `params` | jsonb | 否 | '{}'::jsonb |  |
| `file_path` | text | 是 |  |  |
| `file_name` | text | 是 |  |  |
| `row_count` | integer | 是 |  |  |
| `error_message` | text | 是 |  |  |
| `created_at` | timestamp with time zone | 是 | now() |  |
| `updated_at` | timestamp with time zone | 是 | now() |  |
| `completed_at` | timestamp with time zone | 是 |  |  |

### `tf_favorites`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `user_id` | text | 否 |  |  |
| `menu_item_id` | uuid | 是 |  | FK → tf_menu_items(id) |
| `shop_id` | uuid | 是 |  | FK → tf_shops(id) |
| `created_at` | timestamp with time zone | 是 | now() |  |

### `tf_media_assets`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 否 |  |  |
| `url` | text | 否 |  |  |
| `path` | text | 否 |  |  |
| `file_name` | text | 是 |  |  |
| `mime` | text | 是 |  |  |
| `size_bytes` | integer | 是 |  |  |
| `created_at` | timestamp with time zone | 是 | now() |  |
| `updated_at` | timestamp with time zone | 是 | now() |  |

### `tf_menu_items`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 否 |  | FK → tf_shops(id) |
| `category_id` | uuid | 否 |  | FK → tf_categories(id) |
| `name` | character varying(255) | 否 |  |  |
| `price` | integer | 否 |  |  |
| `image_url` | character varying(500) | 是 | ''::character varying |  |
| `description` | text | 是 | ''::text |  |
| `status` | character varying(20) | 否 | 'active'::character varying |  |
| `sales_count` | integer | 否 | 0 |  |
| `created_at` | timestamp with time zone | 否 | now() |  |
| `updated_at` | timestamp with time zone | 否 | now() |  |
| `monthly_sales` | integer | 是 | 0 |  |
| `spec_group_ids` | ARRAY | 是 | '{}'::uuid[] |  |

### `tf_messages`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 否 |  | FK → tf_shops(id) |
| `from_user_id` | uuid | 否 |  | FK → tf_users(id) |
| `to_user_id` | uuid | 否 |  | FK → tf_users(id) |
| `content` | text | 否 |  |  |
| `read_at` | timestamp with time zone | 是 |  |  |
| `created_at` | timestamp with time zone | 是 | now() |  |

### `tf_notifications`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `user_id` | uuid | 否 |  | FK → tf_users(id) |
| `type` | text | 否 |  |  |
| `title` | text | 否 |  |  |
| `content` | text | 否 | ''::text |  |
| `related_type` | text | 是 |  |  |
| `related_id` | text | 是 |  |  |
| `is_read` | boolean | 否 | false |  |
| `created_at` | timestamp with time zone | 是 | now() |  |

### `tf_order_items`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `order_id` | uuid | 否 |  | FK → tf_orders(id) |
| `menu_item_id` | uuid | 否 |  |  |
| `name` | character varying(255) | 否 |  |  |
| `quantity` | integer | 否 |  |  |
| `price` | integer | 否 |  |  |
| `spec_desc` | character varying(500) | 是 | ''::character varying |  |
| `image_url` | character varying(500) | 是 | ''::character varying |  |
| `created_at` | timestamp with time zone | 否 | now() |  |
| `shop_id` | uuid | 是 |  | FK → tf_shops(id) |

### `tf_order_status_history`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `order_id` | uuid | 否 |  | FK → tf_orders(id) |
| `shop_id` | uuid | 否 |  | FK → tf_shops(id) |
| `status` | text | 否 |  |  |
| `from_status` | text | 是 |  |  |
| `recorded_at` | timestamp with time zone | 是 | now() |  |
| `created_at` | timestamp with time zone | 是 | now() |  |

### `tf_orders`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 否 |  | FK → tf_shops(id) |
| `user_id` | character varying(255) | 否 |  |  |
| `status` | character varying(30) | 否 | 'pending_payment'::character varying |  |
| `total` | integer | 否 |  |  |
| `delivery_type` | character varying(20) | 否 |  |  |
| `address` | character varying(500) | 是 | ''::character varying |  |
| `table_no` | character varying(50) | 是 | ''::character varying |  |
| `remark` | text | 是 | ''::text |  |
| `contact_name` | character varying(100) | 是 | ''::character varying |  |
| `contact_phone` | character varying(50) | 是 | ''::character varying |  |
| `created_at` | timestamp with time zone | 否 | now() |  |
| `updated_at` | timestamp with time zone | 否 | now() |  |
| `delivery_fee` | integer | 是 | 0 |  |
| `rider_id` | text | 是 |  |  |
| `invoice_needed` | boolean | 是 | false |  |
| `invoice_title` | text | 是 |  |  |
| `invoice_tax_no` | text | 是 |  |  |
| `order_no` | text | 是 |  |  |
| `shop_latitude` | numeric | 是 |  |  |
| `shop_longitude` | numeric | 是 |  |  |
| `delivery_latitude` | numeric | 是 |  |  |
| `delivery_longitude` | numeric | 是 |  |  |
| `estimated_completion` | timestamp with time zone | 是 |  |  |
| `cancel_requested_at` | timestamp with time zone | 是 |  |  |
| `cancel_request_reason` | text | 是 |  |  |
| `last_urged_at` | timestamp with time zone | 是 |  |  |
| `urge_count` | integer | 否 | 0 |  |
| `cancel_reason` | text | 是 |  |  |
| `reject_reason` | text | 是 |  |  |

### `tf_payments`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `order_id` | uuid | 是 |  | FK → tf_orders(id) |
| `transaction_id` | text | 是 |  |  |
| `amount` | integer | 否 |  |  |
| `method` | text | 是 | 'wechat'::text |  |
| `status` | text | 是 | 'pending'::text |  |
| `created_at` | timestamp with time zone | 是 | now() |  |
| `shop_id` | uuid | 是 |  | FK → tf_shops(id) |
| `user_id` | text | 是 |  |  |
| `paid_at` | timestamp with time zone | 是 |  |  |
| `updated_at` | timestamp with time zone | 是 | now() |  |

### `tf_promotions`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 否 |  | FK → tf_shops(id) |
| `type` | character varying(30) | 否 |  |  |
| `name` | character varying(255) | 否 |  |  |
| `description` | text | 是 | ''::text |  |
| `rule` | jsonb | 否 | '{}'::jsonb |  |
| `start_date` | timestamp with time zone | 是 |  |  |
| `end_date` | timestamp with time zone | 是 |  |  |
| `status` | character varying(20) | 否 | 'inactive'::character varying |  |
| `created_at` | timestamp with time zone | 否 | now() |  |
| `updated_at` | timestamp with time zone | 否 | now() |  |

### `tf_reviews`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `order_id` | uuid | 否 |  | FK → tf_orders(id) |
| `shop_id` | uuid | 否 |  | FK → tf_shops(id) |
| `user_id` | text | 否 |  |  |
| `rating` | integer | 否 |  |  |
| `content` | text | 是 | ''::text |  |
| `reply_content` | text | 是 | ''::text |  |
| `reply_at` | timestamp with time zone | 是 |  |  |
| `created_at` | timestamp with time zone | 是 | now() |  |

### `tf_role_applications`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `user_id` | uuid | 否 |  | FK → tf_users(id) |
| `apply_role` | text | 否 |  |  |
| `status` | text | 否 | 'pending'::text |  |
| `shop_name` | text | 是 |  |  |
| `shop_address` | text | 是 |  |  |
| `shop_phone` | text | 是 |  |  |
| `contact_name` | text | 是 |  |  |
| `contact_phone` | text | 是 |  |  |
| `payload` | jsonb | 是 | '{}'::jsonb |  |
| `reject_reason` | text | 是 |  |  |
| `reviewer_id` | uuid | 是 |  |  |
| `reviewed_at` | timestamp with time zone | 是 |  |  |
| `created_at` | timestamp with time zone | 是 | now() |  |
| `updated_at` | timestamp with time zone | 是 | now() |  |

### `tf_shop_tables`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 否 |  |  |
| `table_no` | text | 否 |  |  |
| `label` | text | 是 | ''::text |  |
| `sort_order` | integer | 是 | 0 |  |
| `active` | boolean | 是 | true |  |
| `created_at` | timestamp with time zone | 是 | now() |  |

### `tf_shops`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `name` | character varying(255) | 否 |  |  |
| `description` | text | 是 | ''::text |  |
| `address` | character varying(500) | 是 | ''::character varying |  |
| `phone` | character varying(50) | 是 | ''::character varying |  |
| `logo_url` | character varying(500) | 是 | ''::character varying |  |
| `status` | character varying(20) | 否 | 'open'::character varying |  |
| `created_at` | timestamp with time zone | 否 | now() |  |
| `updated_at` | timestamp with time zone | 否 | now() |  |
| `business_hours` | jsonb | 是 |  |  |
| `avatar_url` | text | 是 |  |  |
| `delivery_range` | integer | 是 | 3000 |  |
| `delivery_fee` | integer | 是 | 500 |  |
| `min_order_amount` | integer | 是 | 0 |  |
| `shop_no` | text | 是 |  |  |
| `latitude` | numeric | 是 |  |  |
| `longitude` | numeric | 是 |  |  |
| `delivery_confirm_radius_m` | integer | 是 | 500 |  |
| `voice_alert_config` | jsonb | 是 |  |  |

### `tf_spec_groups`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `shop_id` | uuid | 否 |  | FK → tf_shops(id) |
| `name` | character varying(255) | 否 |  |  |
| `is_required` | boolean | 否 | true |  |
| `max_select` | integer | 否 | 1 |  |
| `created_at` | timestamp with time zone | 否 | now() |  |
| `updated_at` | timestamp with time zone | 否 | now() |  |

### `tf_spec_options`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `spec_group_id` | uuid | 否 |  | FK → tf_spec_groups(id) |
| `name` | character varying(255) | 否 |  |  |
| `price_adjust` | integer | 否 | 0 |  |
| `is_default` | boolean | 否 | false |  |
| `created_at` | timestamp with time zone | 否 | now() |  |
| `updated_at` | timestamp with time zone | 否 | now() |  |

### `tf_user_roles`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `user_id` | uuid | 否 |  | FK → tf_users(id) |
| `role` | text | 否 |  |  |
| `shop_id` | uuid | 是 |  | FK → tf_shops(id) |
| `status` | text | 否 | 'active'::text |  |
| `created_at` | timestamp with time zone | 是 | now() |  |
| `updated_at` | timestamp with time zone | 是 | now() |  |

### `tf_user_sessions`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `user_id` | text | 否 |  |  |
| `token_hash` | text | 否 |  |  |
| `expires_at` | timestamp with time zone | 否 |  |  |
| `refresh_token_hash` | text | 是 |  |  |
| `refresh_expires_at` | timestamp with time zone | 是 |  |  |
| `created_at` | timestamp with time zone | 是 | now() |  |

### `tf_users`

| 字段 | 类型 | 可空 | 默认值 | 键 / 引用 |
|------|------|------|--------|-----------|
| `id` | uuid | 否 | gen_random_uuid() | PK |
| `openid` | text | 否 |  |  |
| `userId` | text | 是 |  |  |
| `role` | text | 是 | 'customer'::text |  |
| `nick_name` | text | 是 |  |  |
| `avatar_url` | text | 是 |  |  |
| `created_at` | timestamp with time zone | 是 | now() |  |
| `shop_id` | uuid | 是 |  | FK → tf_shops(id) |
| `username` | text | 是 |  |  |
| `password_hash` | text | 是 |  |  |
| `phone` | text | 是 |  |  |
| `last_login_at` | timestamp with time zone | 是 |  |  |
| `updated_at` | timestamp with time zone | 是 | now() |  |
| `status` | text | 否 | 'active'::text |  |

## 与 `docs/database-init.sql` 的差异

> init.sql 中 `CREATE TABLE tf_` 共 **26** 张；生产库 tf_ 表 **26** 张。

### 生产库有、但 init.sql 未定义（0 张）

- 无

### init.sql 有、但生产库不存在（0 张）

- 无

> 说明：大量「生产库有但 init 未定义」的表来自后续迁移（v22–v38 系列），属于已知 schema 漂移。若需 init.sql 作为权威初始化脚本，应把这些表补回 init.sql（或明确 init.sql 仅覆盖基线、其余靠迁移增量维护）。
