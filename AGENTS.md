# Agents

项目上下文文件，每次会话开始时必读。

## 项目概述

**taste_food_order** — 面向线下小餐饮店的扫码点餐微信小程序系统。

- AppID: `wx93c16508eff05096`（个人主体）
- 根目录: `/Users/zhaolong/前端/vibe-coding-project/taste-food`

## 文档体系

项目文档由两个核心文件组成，职责分离：

```
docs/
├── prd.md              # 需求文档 — "要什么"
├── tasks.md            # 任务看板 — "做什么、做到哪了"
├── database-init.sql   # 数据库初始化脚本
└── archive/            # 归档文档
```

### prd.md — 产品需求文档

**职责**: 定义"要构建什么"，不涉及执行细节。

| 章节 | 内容 |
|------|------|
| 项目概述 | 产品定位、AppID |
| 用户角色 | 顾客/商家/骑手/游客/管理员 |
| 功能清单 | 按角色分类的功能列表 + 优先级（P0/P1/P2/P3） |
| API 接口清单 | 所有 REST API 路径、方法、鉴权要求 |
| 数据库设计 | 表结构、字段、状态流转 |
| 技术架构 | 系统架构图（含 PC 管理后台） |
| 开发路线图 | Phase 规划 |

**原则**: 
- 只写"要什么"，不写"怎么做"
- 不记录任务状态（那是 tasks.md 的事）
- 不记录已修复的 bug 细节

### tasks.md — 任务看板

**职责**: 统一追踪所有开发任务的状态，是唯一的执行状态源。

**状态流转**: `todo` → `in_progress` → `done` | `blocked`

**任务结构**:
```
| ID | 任务 | 模块 | PRD 关联 | 备注 |
| T01 | 搜索菜品前端实现 | menu | §3.1.2 | 需防抖 |
```

**原则**:
- 每条任务必须关联 prd.md 章节（如 `§3.1.2`）
- 每个 PRD 功能拆解为子任务 `TX.N`（如 T47.1, T47.2, T47.3）
- 完成的任务标记 `done` + 完成日期
- 所有子任务 done → prd.md 功能标记 `✅`
- 新发现的问题作为新任务追加，不写入 prd.md

### 文档关联关系

```
prd.md (需求)                    tasks.md (执行)
┌─────────────────┐             ┌─────────────────┐
│ §3.1.2 菜单浏览  │ ───关联───→ │ T02 菜单浏览实现  │ done
│                 │             │ T15 搜索菜品      │ done
│                 │             │ T26 规格渲染完善   │ done
│                 │             │ T47 菜品收藏(P3)  │ todo
└─────────────────┘             └─────────────────┘
```

**工作流**:
1. **需求进来** → 写入 `prd.md` 功能清单
2. **需求拆解** → 在 `tasks.md` 创建关联任务（标注 PRD 章节）
3. **执行任务** → 修改代码，更新 tasks.md 状态
4. **验证完成** → 任务标记 `done`，相关 PRD 章节无需改动
5. **发现新问题** → 在 `tasks.md` 追加新任务

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
│   ├── types/       api, cart, menu, order, shop
│   └── utils/       constants, format, iconMap
├── config/          Taro 编译配置

admin/           PC 管理后台 (React + Ant Design Pro + UMI)
├── src/
│   ├── pages/       Dashboard, Login, Menu (Category/Item), Order, Promotion, Shop, User
│   ├── components/  OrderStatusTag, PriceDisplay
│   ├── services/    api, auth, menu, order, promotion, shop, user
│   ├── app.tsx      布局配置、路由、请求拦截
│   └── access.ts    权限控制
├── config/          UMI 编译配置

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

## 关键规则

- 金额存储为整数（分），前端通过 `formatPrice()` 转换展示
- API 统一前缀 `/api/`，响应格式 `{ code: 0, data: T, message: string }`
- 所有业务表含 `shop_id` 字段（多租户预留）
- HTTP 状态码: 200 成功, 201 创建, 400 参数错误, 401 未认证, 403 无权限, 404 不存在, 500 服务器错误

## 订单状态流转

```
pending_payment → paid → accepted → preparing → delivering → completed
                   ↘ cancelled                  ↘ rejected
```

## 配送类型

- `delivery` — 外卖配送 | `pickup` — 到店自取 | `dine_in` — 堂食

## 数据库表 (tf_ 前缀)

shops, categories, menu_items, spec_groups, spec_options, orders, order_items, delivery_info, promotions

## 运行命令

```bash
# 后端（端口 3010，自动清理旧进程）
cd server && npm run start:dev

# 前端小程序（端口 3011，自动清理旧进程）
cd client && npm run start

# PC 管理后台（端口 3012）
cd admin && npm start
```

> 注意：小程序模拟器中 `localhost` 无法访问宿主机后端，
> 请确保 `client/src/env.ts` 中 API_BASE_URL 和 WS_URL 使用 `127.0.0.1` 或局域网 IP。

## 开发策略

- **任务驱动**：所有开发工作以 `tasks.md` 中的任务为单位执行
- **任务原子化**：单个 Task 工作量控制在 15 分钟 - 1 小时内
- **关联明确**：每条任务必须标注 PRD 章节（如 `§3.1.2`）
- **状态同步**：任务完成立即更新 tasks.md，不留延迟
- **三位一体同步**：任何数据库或逻辑变更，必须同步更新：1. 代码 2. `database-init.sql` 3. `prd.md` 数据模型
- **错误处理**：所有 API 逻辑必须包含 try-catch 结构，并返回标准响应格式
- 所有业务数据必须持久化到 Supabase，禁止内存 Map
- 多表写入（如订单创建）必须使用数据库事务
- 高频组件提取到 `components/`，统一使用 SCSS + 设计令牌

## 需求-任务闭环流程（必须遵守）

### 流程定义

```
需求进来 → prd.md 功能清单 → tasks.md 任务拆解 → 开发执行 → 状态回填 → 功能完成
```

### 详细步骤

| 步骤 | 动作 | 产出 | 关联文档 |
|------|------|------|----------|
| 1. 需求录入 | 将需求写入 prd.md 功能清单 | 功能条目 + 优先级 | prd.md |
| 2. 任务拆解 | 将功能拆解为原子任务 | 任务条目（T01, T02...） | tasks.md |
| 3. 关联建立 | 每个任务标注 PRD 章节 | `§3.1.2` 格式关联 | tasks.md |
| 4. 开发执行 | 按任务逐个开发 | 代码变更 | 代码 |
| 5. 状态更新 | 完成后更新 tasks.md 状态 | `done` + 完成日期 | tasks.md |
| 6. 功能闭环 | 所有子任务完成后，更新 prd.md 功能状态 | `✅` 标记 | prd.md |

### 关联关系示例

```
prd.md 功能: 菜品收藏 (§3.5)
    ↓ 关联
tasks.md 任务:
    ├── T47.1 后端收藏 API 实现
    ├── T47.2 前端收藏按钮
    └── T47.3 收藏列表展示

全部 done → prd.md 标记 ✅
```

### 子任务拆解规范

每个 PRD 功能必须拆解为子任务，格式为 `TX.N`（功能编号.子任务序号）：

```
prd.md §3.5.1 菜品收藏
    ├── T47.1 后端收藏 API（CRUD + 内存回退）
    ├── T47.2 前端收藏按钮（心形图标 + toggle）
    └── T47.3 收藏列表展示（独立页面）

prd.md §3.5.2 Token 自动续期
    ├── T48.1 后端双 Token 生成（access 15m + refresh 7d）
    ├── T48.2 后端 refresh 接口（token 轮换）
    └── T48.3 前端自动刷新（14min 定时器）
```

**拆解原则**：
- 子任务可独立开发和验证（单一职责）
- 每个子任务 15-60 分钟可完成
- 子任务按依赖顺序排列（后端先，前端后）

### 状态同步规则（强制闭环）

1. **任务完成时**：立即更新 tasks.md，标记 `done` + 完成日期
2. **功能闭环时**：检查该功能下所有子任务是否 `done`
   - 全部 done → 更新 prd.md 功能状态为 `✅`
   - 任一未完成 → prd.md 保持原状态
3. **任务归档**：功能标记 `✅` 后，tasks.md 中对应任务移至"已完成"区域
4. **禁止跳过**：不能只更新 prd.md 不更新 tasks.md，反之亦然

### 闭环验证清单（每次新功能完成时执行）

- [ ] 所有子任务（TX.1, TX.2...）在 tasks.md 中标记 `done`
- [ ] prd.md 对应功能行添加 `✅` 标记
- [ ] prd.md 功能行补充完成日期
- [ ] tasks.md 中已完成任务移至"已完成"分组

### 禁止事项

- ❌ 只写 prd.md 不拆解任务
- ❌ 只做任务不关联 prd
- ❌ 任务完成不同步状态到 prd
- ❌ 功能完成不检查所有子任务
- ❌ 子任务跳过直接完成父功能

## 数据库变更同步规范

## 数据库变更同步规范

1. **全量同步**：任何数据库变更必须实时更新到 `docs/database-init.sql`
2. **前缀规范**：所有业务表使用 `tf_` 前缀
3. **RLS 默认状态**：新表应包含 `DISABLE ROW LEVEL SECURITY`
4. **三位一体**：变更需同步：1. 实际数据库 2. `database-init.sql` 3. `prd.md` 数据模型
