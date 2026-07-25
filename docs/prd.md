# 小买卖点餐系统 — 产品需求文档

> **版本**: v15.13<br>
> **更新日期**: 2026-07-25<br>
> **仓库**: `/Users/zhaolong/前端/vibe-coding-project/taste-food`  
> **任务看板**: `docs/tasks.md`  
> **开发状态**: ✅ 已达个人主体约 90% 可演示上线（支付默认沙箱；真实微信支付暂缓；旧库 schema 由服务端兼容回退）

---

## 一、项目概述

面向线下小餐饮店的**扫码点餐微信小程序系统**，覆盖从浏览菜单到订单完成的完整交易闭环。

**AppID**: `wx93c16508eff05096`（个人主体）

---

## 二、用户角色

| 角色 | 说明 | 入口 |
|------|------|------|
| 顾客 | 扫码点餐、浏览菜单、下单支付、查看订单 | 菜单页 |
| 商家 | 接单/拒单、管理菜品、查看营收、开关店、查看会员 | 商家管理页 |
| 骑手 | 抢单、取货、确认送达 | 骑手页 |
| 游客 | 未登录浏览菜单 | 登录页「先逛逛」 |
| 管理员 | PC 端管理店铺、菜品、订单、用户、促销 | PC 管理后台 |

---

## 三、功能清单

### 3.1 顾客端 ✅ 全部完成

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| ✅ 微信登录 | P0 | T01 | done |
| ✅ 角色切换 | P0 | T01 | done |
| ✅ 菜单浏览 | P0 | T02, T03, T26 | done |
| ✅ 搜索菜品 | P1 | T15 | done |
| ✅ 购物车 | P0 | T04, T24 | done |
| ✅ 确认订单 | P0 | T05 | done |
| ✅ 促销活动 | P1 | T19 | done |
| ✅ 模拟/沙箱支付 | P0 | T06, T150 | done |
| ✅ 订单管理 | P0 | T07, T21, T23 | done |

### 3.2 商家端（小程序）✅ 全部完成

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| ✅ 商家首页 | P0 | T09, T17, T20 | done |
| ✅ 订单管理 | P0 | T10 | done |
| ✅ 菜品管理 | P0 | T11, T28 | done |
| ✅ 分类管理 | P1 | T16 | done |
| ✅ 用户管理 | P1 | T25 | done |

### 3.3 骑手端 ✅ 全部完成

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| ✅ 抢单 | P0 | T29 | done |
| ✅ 配送确认 | P0 | T29 | done |

### 3.4 PC 管理后台 ✅ 全部完成

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| ✅ 项目初始化 | P3 | T42 | done |
| ✅ 数据看板 | P3 | T49 | done |
| ✅ 店铺管理 | P3 | T50 | done |
| ✅ 分类管理 | P3 | T51 | done |
| ✅ 菜品管理 | P3 | T52 | done |
| ✅ 订单管理 | P3 | T53 | done |
| ✅ 用户管理 | P3 | T54 | done |
| ✅ 促销管理 | P3 | T55 | done |

### 3.5 P3 功能完善 ✅ 全部完成

| 功能 | 优先级 | 任务 | 状态 | 完成日期 |
|------|--------|------|------|----------|
| ✅ 配送范围设置 | P3 | T44 | done | 2026-06-25 |
| ✅ 多店铺管理 | P3 | T46 | done | 2026-06-25 |
| ✅ 菜品收藏 | P3 | T47 | done | 2026-06-25 |
| ✅ Token 自动续期 | P3 | T48 | done | 2026-06-25 |
| ✅ 数据可视化 | P3 | T45 | done | 2026-06-25 |

### 3.6 测试用例 ✅ 已完成

| 功能 | 优先级 | 任务 | 状态 | 完成日期 |
|------|--------|------|------|----------|
| ✅ Admin 单元测试 | P3 | T63 | done | 2026-06-25 |
| ✅ Server 服务测试基线 | P2 | T167 | done | 2026-07-25 |
| ✅ Server 支付与订单状态测试 | P2 | T170 | done | 2026-07-25 |
| ✅ Server 下单核价与门店约束测试 | P2 | T172 | done | 2026-07-25 |
| ✅ Server 地址簿服务测试 | P2 | T174 | done | 2026-07-25 |
| ✅ Server 评价服务测试 | P2 | T175 | done | 2026-07-25 |
| ✅ Server 审计日志服务测试 | P2 | T176 | done | 2026-07-25 |
| ✅ Server 桌台服务测试与校验补强 | P2 | T177 | done | 2026-07-25 |
| ✅ Server 门店服务测试与免配送费修复 | P2 | T178 | done | 2026-07-25 |
| ✅ Server 促销服务测试与生效窗口修复 | P2 | T179 | done | 2026-07-25 |
| ✅ Client 测试输出降噪 | P2 | T169 | done | 2026-07-25 |
| ✅ Server 测试输出降噪 | P2 | T171 | done | 2026-07-25 |

### 3.7 文档与配置 ✅ 已完成

| 功能 | 优先级 | 任务 | 状态 | 完成日期 |
|------|--------|------|------|----------|
| ✅ README.md | P1 | T64 | done | 2026-06-25 |
| ✅ .env.example | P1 | T65 | done | 2026-06-25 |
| ✅ .gitignore 优化 | P1 | T66 | done | 2026-06-25 |
| ✅ Client Sass 模块语法 | P2 | T168 | done | 2026-07-25 |
| ✅ 统一质量门禁脚本 | P2 | T173 | done | 2026-07-25 |

### 3.8 部署配置 ✅ 已完成

| 功能 | 优先级 | 任务 | 状态 | 完成日期 |
|------|--------|------|------|----------|
| ✅ Dockerfile (server) | P2 | T67 | done | 2026-06-25 |
| ✅ Dockerfile (admin) | P2 | T68 | done | 2026-06-25 |
| ✅ docker-compose.yml | P2 | T69 | done | 2026-06-25 |
| ✅ Nginx 配置 | P2 | T70 | done | 2026-06-25 |

### 3.9 API 文档 ✅ 已完成

| 功能 | 优先级 | 任务 | 状态 | 完成日期 |
|------|--------|------|------|----------|
| ✅ OpenAPI/Swagger | P2 | T71 | done | 2026-06-25 |

### 3.10 CI/CD 与监控 ✅ 已完成

| 功能 | 优先级 | 任务 | 状态 | 完成日期 |
|------|--------|------|------|----------|
| ✅ GitHub Actions | P3 | T72 | done | 2026-06-25 |
| ✅ 健康检查端点 | P3 | T73 | done | 2026-06-25 |
| ✅ CI 复用统一质量门禁 | P2 | T173 | done | 2026-07-25 |

### 3.11 未来规划（暂缓）

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| 真实微信支付 | P3 | T43 | 暂缓（需企业资质） |

### 3.12 体验增强 ✅ 2026-07-24

> 在支付（T43 真实微信支付）暂缓前提下，补齐线下门店运营与顾客下单体验。<br>
> 本轮不涉及真实支付。

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 商家新订单提醒强化 | P2 | T151 | ✅ 2026-07-24 | 新订单振动/铃声/角标/横幅，降低商家漏单 |
| ✅ 营业时段管理 | P2 | T152 | ✅ 2026-07-24 | 按星期配置营业时段；非营业时段拦截下单并提示 |
| ✅ 顾客地址簿 | P2 | T153 | ✅ 2026-07-24 | 多地址 CRUD、默认地址；确认订单页一键选用 |
| ✅ 订单评价 | P2 | T154 | ✅ 2026-07-24 | 完成后评分+文字；商家/后台可查看 |
| ✅ 通用弱网/错误重试/空态引导 | P2 | T155 | ✅ 2026-07-24 | 请求失败可重试、弱网提示、空态 CTA |
| ✅ 下单备注与发票信息 | P2 | T156 | ✅ 2026-07-24 | 订单备注、是否开票、抬头/税号；商家与 admin 可见 |

**本轮不做**: 批量异步导出任务（可后续追加；已支持同步 CSV 导出）。配送轨迹地图已在 §3.17 补齐。

### 3.13 体验收尾打磨 ✅ 2026-07-24

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 收藏页一键加购 | P2 | T159.1 | ✅ 2026-07-24 | 收藏列表可直接加购 |
| ✅ 菜单地址簿入口 | P2 | T159.2 | ✅ 2026-07-24 | 菜单页快捷进入地址簿 |
| ✅ 新订单提示音 | P2 | T159.3 | ✅ 2026-07-24 | 商家新单振动 + 本地提示音 |
| ✅ 再来一单回填 | P2 | T159.5 | ✅ 2026-07-24 | 回填备注/规格/店铺 |

---


### 3.14 桌号扫码入座 ✅ 2026-07-24

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 桌台管理 API | P2 | T160.1 | ✅ 2026-07-24 | 桌台 CRUD / 默认 A01-A10 / scanPath |
| ✅ 扫码识别桌号 | P2 | T160.2 | ✅ 2026-07-24 | 菜单解析 query/scene，堂食横幅，确认页默认桌号 |
| ✅ 后台桌台二维码 | P2 | T160.3 | ✅ 2026-07-24 | admin 桌台列表与打印辅助二维码 |

> 正式环境建议使用微信「小程序码」scene=`t=桌号`；开发可用 path 普通二维码辅助。


### 3.15 运营工具 ✅ 2026-07-24

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 订单 CSV 导出 | P2 | T161 | ✅ 2026-07-24 | 管理后台按状态导出订单 |
| ✅ 评价商家回复 | P2 | T162 | ✅ 2026-07-24 | 商家回复顾客评价，顾客端可见 |


### 3.16 操作审计日志 ✅ 2026-07-24

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 商家写操作审计 | P2 | T163 | ✅ 2026-07-24 | 自动记录 Admin 写接口；后台可查询 |


### 3.17 配送轨迹地图 ✅ 2026-07-24

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 配送轨迹持久化 | P2 | T164.1 | ✅ 2026-07-24 | 记录骑手经纬度、速度、精度与上报时间 |
| ✅ 顾客订单详情地图 | P2 | T164.2 | ✅ 2026-07-24 | 外卖订单展示地图、路线、骑手当前位置与更新时间 |
| ✅ 骑手位置上报 | P2 | T164.3 | ✅ 2026-07-24 | 骑手配送中可上报位置；开发环境支持演示坐标兜底 |

## 四、API 接口清单

### 4.1 认证
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/wechat-login` | 微信登录 | 否 |

### 4.2 店铺
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/shops/:id` | 获取店铺信息 | 否 |
| GET | `/api/shops` | 获取所有店铺 | 否 |
| PATCH | `/api/shops/:id/status` | 开关店 | 是（Admin） |
| PATCH | `/api/shops/:id` | 更新店铺信息（含营业时段 business_hours） | 是（Admin） |
| GET | `/api/shops/:id/business-hours` | 获取营业时段与当前是否可下单 | 否 |
| GET | `/api/shops/:id/tables` | 启用中的桌台列表（含 scanPath） | 否 |
| GET | `/api/shops/:id/tables/manage` | 管理端桌台列表（含停用） | 是（Admin） |
| POST | `/api/shops/:id/tables` | 新增桌台 | 是（Admin） |
| POST | `/api/shops/:id/tables/seed` | 初始化 A01-A10 | 是（Admin） |
| PATCH | `/api/shops/:id/tables/:tableId` | 更新桌台 | 是（Admin） |
| DELETE | `/api/shops/:id/tables/:tableId` | 删除桌台 | 是（Admin） |
| PATCH | `/api/shops/:id/business-hours` | 更新营业时段 | 是（Admin） |

### 4.3 菜单
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/categories` | 分类列表（支持 `shop_id`） | 否 |
| GET | `/api/menu-items` | 菜品列表（支持 `shop_id` + `category_id` + `search`） | 否 |
| GET | `/api/menu-items/popular` | 热门菜品排行 | 否 |
| GET | `/api/menu-items/:id` | 单品详情 | 否 |
| GET | `/api/menu-items/:id/specs` | 菜品规格 | 否 |
| POST | `/api/categories` | 新增分类 | 是（Admin） |
| PATCH | `/api/categories/:id` | 编辑分类 | 是（Admin） |
| DELETE | `/api/categories/:id` | 删除分类 | 是（Admin） |
| POST | `/api/menu-items` | 新增菜品 | 是（Admin） |
| PATCH | `/api/menu-items/:id` | 编辑菜品 | 是（Admin） |
| DELETE | `/api/menu-items/:id` | 删除菜品 | 是（Admin） |

### 4.4 订单
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/orders` | 订单列表（分页+筛选） | 是 |
| GET | `/api/orders/stats/:shopId` | 今日营收统计 | 是（Admin） |
| GET | `/api/orders/:id` | 订单详情 | 是 |
| POST | `/api/orders` | 创建订单 | 是 |
| POST | `/api/orders/:id/status` | 更新订单状态 | 是（Admin） |
| POST | `/api/orders/:id/cancel` | 取消订单 | 是 |
| POST | `/api/orders/:id/reorder` | 再来一单 | 是 |
| POST | `/api/orders/:id/reviews` | 提交订单评价（仅 completed 且本人一次） | 是 |
| GET | `/api/orders/:id/reviews` | 查询订单评价 | 是 |

### 4.5 支付
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/orders/:id/pay` | 支付（默认 sandbox 沙箱；可配 wechat/third_party） | 是 |
| GET | `/api/orders/:id/payment` | 查询支付记录 | 是 |

支付渠道（环境变量 `PAYMENT_PROVIDER`）：
- `sandbox`：开发/演示默认，立即成功，响应 `mock:true, provider:sandbox`
- `wechat`：官方微信支付（需企业商户号，个人主体不可用）
- `third_party`：第三方聚合预留（非免费、合规风险高，暂未实现）

### 4.6 促销
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/promotions` | 获取可用优惠 | 否 |
| POST | `/api/promotions` | 新增促销 | 是（Admin） |
| PATCH | `/api/promotions/:id` | 编辑促销 | 是（Admin） |
| DELETE | `/api/promotions/:id` | 删除促销 | 是（Admin） |

### 4.7 存储
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/storage/images/menu` | 上传菜品图片（≤5MB） | 是 |
| DELETE | `/api/storage/images/:path` | 删除图片 | 是 |

### 4.8 用户
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/users` | 会员列表（分页） | 是（Admin） |
| GET | `/api/users/:id` | 会员详情 | 是（Admin） |

### 4.9 地址簿（体验增强）
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/addresses` | 当前用户地址列表 | 是 |
| POST | `/api/addresses` | 新增地址 | 是 |
| PATCH | `/api/addresses/:id` | 更新地址 | 是 |
| DELETE | `/api/addresses/:id` | 删除地址 | 是 |
| PATCH | `/api/addresses/:id/default` | 设为默认地址 | 是 |

### 4.11 操作审计
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/audit-logs` | 审计日志分页列表 | 是（Admin） |

### 4.10 评价列表（体验增强）
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/reviews` | 店铺评价列表（分页） | 是（Merchant/Admin） |
| PATCH | `/api/reviews/:id/reply` | 商家回复评价 | 是（Admin） |

### 4.12 配送轨迹
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/orders/:id/delivery-track` | 查询订单配送轨迹点 | 是（订单本人/本店商家/接单骑手） |
| POST | `/api/orders/:id/delivery-track` | 上报配送位置 | 是（Rider/Admin） |

---

## 五、数据库设计

### 5.1 数据表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `tf_shops` | 店铺 | id, name, status, description, address, phone, logo_url, delivery_fee, min_order_amount, delivery_range, business_hours |
| `tf_categories` | 分类 | id, shop_id, name, sort_order, icon_key |
| `tf_menu_items` | 菜品 | id, shop_id, category_id, name, price, monthly_sales, spec_group_ids, status, image_url, description |
| `tf_spec_groups` | 规格组 | id, shop_id, name, is_required, max_select |
| `tf_spec_options` | 规格选项 | id, spec_group_id, name, price_adjust |
| `tf_orders` | 订单 | id, shop_id, user_id, rider_id, status, total, delivery_fee, delivery_type, address, table_no, contact_name, contact_phone, remark, invoice_needed, invoice_title, invoice_tax_no |
| `tf_order_items` | 订单项 | id, order_id, shop_id, menu_item_id, name, quantity, price, spec_desc, image_url |
| `tf_delivery_info` | 配送信息 | id, order_id, shop_id, courier_name, courier_phone, estimated_delivery_at, delivered_at |
| `tf_delivery_tracks` | 配送轨迹点 | id, order_id, shop_id, rider_id, latitude, longitude, speed, accuracy, source, recorded_at |
| `tf_promotions` | 优惠活动 | id, shop_id, name, type, rule, status, start_date, end_date |
| `tf_users` | 用户 | id, openid, user_id, role, shop_id, nick_name, avatar_url |
| `tf_payments` | 支付记录 | id, order_id, shop_id, user_id, amount, method, status, paid_at |
| `tf_favorites` | 菜品收藏 | id, user_id, menu_item_id, shop_id, created_at（UNIQUE(user_id, menu_item_id)） |
| `tf_daily_stats` | 每日销售统计 | id, shop_id, stat_date, total_orders, total_revenue, completed_orders, cancelled_orders（UNIQUE(shop_id, stat_date)） |
| `tf_item_sales` | 菜品销售明细 | id, menu_item_id, shop_id, order_id, order_date, quantity, revenue |
| `tf_addresses` | 顾客地址簿 | id, user_id, shop_id, contact_name, contact_phone, detail, tag, is_default, created_at |
| `tf_audit_logs` | 操作审计日志 | id, shop_id, user_id, role, method, path, action, resource, resource_id, summary, status_code, ip, created_at |
| `tf_shop_tables` | 店铺桌台 | id, shop_id, table_no, label, sort_order, active, created_at（UNIQUE(shop_id,table_no)） |
| `tf_reviews` | 订单评价 | id, order_id, shop_id, user_id, rating, content, reply_content, reply_at, created_at（UNIQUE(order_id)） |

> `business_hours` 建议结构：`{ mon:[{start,end}], ..., sun:[...] }`，空数组表示当日休息。<br>
> 多租户规范：所有业务表均含 `shop_id` 字段用于店铺隔离。
> 数据库约束：text 枚举字段（status/delivery_type/role/type/method）均含 CHECK 约束防止非法值；外键含 ON DELETE 行为（CASCADE/RESTRICT/SET NULL）。

### 5.2 订单状态流转

```
pending_payment → paid → accepted → preparing → delivering → completed
                                       ↘ ready_for_pickup → completed
                   ↘ cancelled                  ↘ rejected
```

- `delivering` — 外卖配送（delivery 类型订单）
- `ready_for_pickup` — 待取餐（pickup/dine_in 类型订单，备餐完成）
- `cancelled` — 仅 `pending_payment`/`paid` 状态可取消（已支付触发退款）

### 5.3 配送类型

- `delivery` — 外卖配送
- `pickup` — 到店自取
- `dine_in` — 堂食

---

## 六、技术架构

```
┌─────────────────────────────────────────────────┐
│              微信小程序 (Taro 4 + React)          │
│  菜单页 → 确认页 → 支付 → 订单列表 → 订单详情/轨迹 │
│  商家管理页（首页/订单/菜品/用户）                 │
│  骑手页（抢单/确认送达）                          │
│  Zustand + Storage + ErrorBoundary               │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┼──────────────────────────────┐
│           NestJS 后端 (Port 3010)                 │
│  Auth → Shop → Menu → Order → Payment            │
│  Promotion → Storage → User → Notification       │
│  WebSocket Gateway / Supabase (PostgreSQL)       │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│        PC 管理后台 (Port 3012)                    │
│  React + Ant Design Pro + UMI                    │
│  Dashboard / Shop / Menu / Order / User / Promo  │
└─────────────────────────────────────────────────┘
```

---

## 七、开发路线图

| Phase | 内容 | 状态 | 任务范围 |
|-------|------|------|----------|
| Phase 1 | MVP 核心闭环（菜单→下单→支付→订单） | ✅ | T01-T12 |
| Phase 2 | 核心缺陷修复 | ✅ | T13-T14 |
| Phase 3 | P1 功能增强（搜索/促销/横幅/分类管理） | ✅ | T15-T26 |
| Phase 4 | P2 基础设施（图片上传/订阅消息） | ✅ | T27-T28 |
| Phase 5 | 问题修复与优化 | ✅ | T29-T35 |
| Phase 6 | 代码质量优化（60+ bug 修复） | ✅ | T36-T41 |
| Phase 7 | PC 管理后台（React + Ant Design Pro + UMI） | ✅ | T42, T49-T55 |
| Phase 8 | P3 功能完善（配送范围/多店铺/收藏/Token） | ✅ | T44-T48 |
| Phase 9 | 性能优化（分包/字段精简/缓存/memo） | ✅ | T56-T59 |
| Phase 10 | 安全加固与缺陷修复 | ✅ | T90-T134 |
| Phase 11 | UI/体验优化与沙箱支付渠道化 | ✅ | T135-T150 |
| Phase 12 | 体验增强（提醒/营业时段/地址簿/评价/弱网/备注发票） | ✅ | T151-T156 |
| Phase 13 | 体验收尾打磨（收藏加购/地址入口/提示音/再来一单） | ✅ | T159 |
| Phase 14 | 桌号扫码入座（桌台/二维码/堂食上下文） | ✅ | T160 |
| Phase 15 | 运营工具（订单导出/评价回复） | ✅ | T161-T162 |
| Phase 16 | 操作审计日志 | ✅ | T163 |
| Phase 17 | 配送轨迹地图 | ✅ | T164 |
| Phase 18 | 旧库 schema 兼容与上线冒烟验收 | ✅ | T180 |

---

## 八、上线说明（个人主体）

### 8.1 可上线范围
- 顾客：菜单浏览 → 下单 → 沙箱支付 → 订单跟踪 → 评价
- 商家：接单 / 备餐 / 状态推进
- 骑手：抢单 / 轨迹上报（旧库无表时内存） / 确认送达
- 管理后台与小程序商家端可联调演示

### 8.2 已知限制
1. **真实微信支付（T43）** 暂缓，需企业商户号；当前默认 `PAYMENT_PROVIDER=sandbox`。
2. **线上 Supabase schema 落后于** `docs/database-init.sql`：缺部分列/RPC/表（如 `atomic_*`、`tf_delivery_tracks`、`tf_refresh_tokens`、`rider_id`）。服务端已做兼容回退，完整能力需执行 T181 迁移。
3. 旧库无 `rider_id` 时抢单归属仅进程内有效；重启后历史单骑手归属不完整。
4. daily_stats 等依赖 RPC 的聚合在旧库可能弱于完整版。

### 8.3 验收证据（2026-07-25）
- 全链路冒烟：create → pay → accepted → preparing → grab → delivery-track → deliver → review = **SMOKE_OK**
- server unit tests：**53/53**
- `npm run quality:check`：**all checks passed**
