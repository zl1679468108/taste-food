# 小买卖点餐系统 — 产品需求文档

> **版本**: v14.0  
> **更新日期**: 2026-06-25  
> **仓库**: `/Users/zhaolong/前端/vibe-coding-project/taste-food`  
> **任务看板**: `docs/tasks.md`  
> **开发状态**: ✅ 所有功能已完成（除暂缓的真实微信支付）

---

## 一、项目概述

面向线下小餐饮店的**扫码点餐微信小程序系统**，覆盖从浏览菜单到订单完成的完整交易闭环。

**AppID**: `wx93c168508eff05096`（个人主体）

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
| ✅ 模拟支付 | P0 | T06 | done |
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

### 3.7 文档与配置 ✅ 已完成

| 功能 | 优先级 | 任务 | 状态 | 完成日期 |
|------|--------|------|------|----------|
| ✅ README.md | P1 | T64 | done | 2026-06-25 |
| ✅ .env.example | P1 | T65 | done | 2026-06-25 |
| ✅ .gitignore 优化 | P1 | T66 | done | 2026-06-25 |

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

### 3.11 未来规划（暂缓）

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| 真实微信支付 | P3 | T43 | 暂缓（需企业资质） |

---

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

### 4.5 支付
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/orders/:id/pay` | 模拟支付 | 是 |

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

---

## 五、数据库设计

### 5.1 数据表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `tf_shops` | 店铺 | id, name, status, description, address, phone, logo_url, delivery_fee, min_order_amount, delivery_range |
| `tf_categories` | 分类 | id, shop_id, name, sort_order, icon_key |
| `tf_menu_items` | 菜品 | id, shop_id, category_id, name, price, monthly_sales, spec_group_ids, status, image_url, description |
| `tf_spec_groups` | 规格组 | id, shop_id, name, is_required, max_select |
| `tf_spec_options` | 规格选项 | id, spec_group_id, name, price_adjust |
| `tf_orders` | 订单 | id, shop_id, user_id, rider_id, status, total, delivery_fee, delivery_type, address, table_no, contact_name, contact_phone |
| `tf_order_items` | 订单项 | id, order_id, shop_id, menu_item_id, name, quantity, price, spec_desc, image_url |
| `tf_delivery_info` | 配送信息 | id, order_id, shop_id, courier_name, courier_phone, estimated_delivery_at, delivered_at |
| `tf_promotions` | 优惠活动 | id, shop_id, name, type, rule, status, start_date, end_date |
| `tf_users` | 用户 | id, openid, user_id, role, shop_id, nick_name, avatar_url |
| `tf_payments` | 支付记录 | id, order_id, shop_id, user_id, amount, method, status, paid_at |
| `tf_favorites` | 菜品收藏 | id, user_id, menu_item_id, shop_id, created_at（UNIQUE(user_id, menu_item_id)） |
| `tf_daily_stats` | 每日销售统计 | id, shop_id, stat_date, total_orders, total_revenue, completed_orders, cancelled_orders（UNIQUE(shop_id, stat_date)） |
| `tf_item_sales` | 菜品销售明细 | id, menu_item_id, shop_id, order_id, order_date, quantity, revenue |

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
│  菜单页 → 确认页 → 支付 → 订单列表 → 订单详情     │
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
