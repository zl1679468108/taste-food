# Agents

项目上下文文件，每次会话开始时必读。

## 项目概述

**taste_food_order** — 面向线下小餐饮店的扫码点餐微信小程序系统（Taro 小程序 + PC 管理后台 + NestJS 后端 + Supabase）。
- AppID: `wx93c16508eff05096`（个人主体）
- 根目录: `/Users/zhaolong/前端/vibe-coding-project/taste-food`
- 需求 / 功能 / API / 状态机：见 `docs/prd.md`；任务状态：见 `docs/tasks.md`

## 文档索引

| 文档 | 职责 | 何时查 |
|------|------|--------|
| `docs/prd.md` | 需求文档（要什么）：功能清单 / API / 数据模型 / 状态流 | 理解需求、接口、状态机 |
| `docs/tasks.md` | 任务看板（做什么）：状态、PRD 关联、闭环规则 | 拆解 / 认领 / 回填任务 |
| `docs/database-init.sql` | 数据库初始化脚本（与生产库三位一体同步） | 表结构基线、建表 / 改表 |
| `docs/database-schema.md` | 真实表结构（information_schema 自动生成，含 PK/FK 与 init 差异） | 查字段类型、约束、当前 26 张 tf_ 表 |
| `docs/踩坑记录.md` | 踩坑与避坑 checklist | 避开已知事故（如砍表前查 RPC 依赖） |
| `docs/archive/` | 归档文档 | 历史快照 |

> 本文只保留**导航 + 硬规范**。任何细节以上表对应文档为准，不在本文件重复维护。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端（小程序） | Taro 4 + React + TypeScript + NutUI-React + Zustand + SCSS |
| 前端（PC 管理后台） | React + Ant Design Pro + UMI + TypeScript |
| 后端 | NestJS + TypeScript |
| 数据库 | Supabase (PostgreSQL) + socket.io (WebSocket) |
| 工具 | dayjs, uuid |

## 目录结构

```
client/          Taro 微信小程序
├── src/
│   ├── pages/       menu, order-confirm, order-detail, order-list, admin
│   ├── components/  BottomSheet, EmptyState, RoleSwitcher, SkeletonLoader, StatusTimeline
│   ├── stores/      cartStore, menuStore, orderStore, authStore
│   ├── services/    socket.ts (WebSocket), request.ts (HTTP)
│   ├── styles/      _design-tokens.scss（全局样式变量索引）, _mixins.scss
│   ├── types/       api, cart, menu, order, shop
│   └── utils/       constants, format, iconMap
├── config/          Taro 编译配置

admin/           PC 管理后台 (React + Ant Design Pro + UMI)
├── src/
│   ├── pages/       Dashboard, Login, Menu (Category/Item), Order, Promotion, Shop, User
│   ├── components/  OrderStatusTag, PriceDisplay
│   ├── services/    api, auth, menu, order, promotion, shop, user
│   ├── theme.ts     设计令牌（brand + antdTheme，对齐小程序）
│   ├── global.css   CSS 变量 --tf-*（与 theme.ts 同步）
│   ├── app.tsx      布局配置、路由、请求拦截
│   └── access.ts    权限控制
├── config/          UMI 编译配置

shared/          三端共享代码（@taste-food/shared）
├── src/
│   ├── format/      金额/时间等格式化
│   ├── constants/   订单状态、动作映射等常量
│   ├── types/       共享类型
│   └── index.ts     统一导出
├── package.json
└── tsconfig.json

server/          NestJS 后端
├── src/
│   ├── modules/     auth, shop, menu, order, payment
│   ├── common/      guards, filters, pipes, decorators, interfaces
│   ├── database/    supabase.client.ts
│   └── gateway/     order.gateway.ts (WebSocket)
└── supabase/        migrations, seed.sql
```

## 代码规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 前端变量/函数 | camelCase | `getMenuItems()`, `activeCategoryId` |
| 前端组件 | PascalCase | `MenuCard`, `CartBar` |
| 前端文件 | kebab-case | `cart-store.ts` |
| 后端类/DTO | PascalCase | `OrderService`, `CreateOrderDto` |
| 后端文件 | kebab-case | `order.service.ts` |
| 数据库表 | snake_case 复数 + tf_ 前缀 | `tf_menu_items`, `tf_orders` |
| API 路径 | kebab-case | `/api/menu-items` |
| 枚举值 | UPPER_SNAKE_CASE | `PENDING_PAYMENT` |

## 小程序样式变量（必遵）

索引：`client/src/styles/_design-tokens.scss`；接入：`client/src/app.scss`；混入：`client/src/styles/_mixins.scss`
业务 scss 顶部必须：

```scss
@use '../../styles/design-tokens' as *;
// 需要时：@use '../../styles/mixins' as *;
```

**禁止**：硬编码 `#hex`、裸 `font-size: Npx/rpx`、随意字号灰阶；价格色用 `$text-price`。具体 token 名见 `_design-tokens.scss`，不要在页面开特例色值。

## PC 管理后台样式变量

- 令牌：`admin/src/theme.ts`（`brand` / `antdTheme`）；CSS 变量：`admin/src/global.css`（`--tf-*`）
- 与小程序 `client/src/styles/_design-tokens.scss` 语义对齐（主色/灰阶/文字/字号）
- 内联色优先 `brand.xxx` 或 `var(--tf-*)`，价格色用 `brand.textPrice`

## 关键规则

- 金额存整数（分），前端 `formatPrice()` 展示
- API 前缀 `/api/`，响应 `{ code: 0, data: T, message: string }`
- 所有业务表含 `shop_id` 字段（多租户预留）
- HTTP 状态：200 成功 / 201 创建 / 400 参数 / 401 未认证 / 403 无权限 / 404 不存在 / 500 错误

## 业务速查（详情见索引文档）

- **订单状态流转**：`pending_payment → paid → accepted → preparing → delivering/ready_for_pickup → completed`，含 `cancelled` / `rejected` —— 见 `prd.md §5.2`
- **配送类型**：`delivery`（外卖）/ `pickup`（到店自取）/ `dine_in`（堂食）—— 见 `prd.md §5.3`
- **数据库表**：当前 26 张 `tf_` 表（字段 / 主键 / 外键）—— 见 `docs/database-schema.md`
- **踩坑避坑**：见 `docs/踩坑记录.md`

## 运行命令

```bash
cd server && npm run start   # 后端 3010（已运行时跳过）
cd client && npm run start  # 小程序 3011（清理旧进程）
cd admin  && npm start      # PC 后台 3012
```

> 小程序模拟器 `localhost` 无法访问宿主机后端，确保 `client/src/env.ts` 的 `API_BASE_URL` / `WS_URL` 用 `127.0.0.1` 或局域网 IP。

## 开发策略（硬性约定）

- 任务驱动 + 原子化（单任务 15min–1h）；每条任务关联 PRD 章节（如 `§3.1.2`）
- **三位一体同步**：任何变更同步 1. 代码 2. `docs/database-init.sql` 3. `prd.md` 数据模型
- 错误处理：API 逻辑必含 try-catch + 标准响应格式
- 业务数据持久化 Supabase，禁止内存 Map；多表写入（如订单创建）必须用数据库事务
- 需求-任务闭环流程、子任务拆解、状态同步规则：**见 `docs/tasks.md`**（不在本文件重复）

## 数据库变更同步规范

1. 任何 DB 变更实时更新 `docs/database-init.sql`
2. 业务表 `tf_` 前缀；新表含 `DISABLE ROW LEVEL SECURITY`
3. 三位一体：实际库 ↔ `database-init.sql` ↔ `prd.md`
