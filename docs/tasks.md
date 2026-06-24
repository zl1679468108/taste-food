# 任务看板

> **唯一状态源** — 所有开发任务在此追踪  
> **状态**: `todo` → `in_progress` → `done` | `blocked`  
> **关联**: 每条任务链接到 `prd.md` 对应章节  
> **需求文档**: `docs/prd.md`

---

## 已完成

| ID | 任务 | 模块 | PRD 关联 | 完成日期 |
|----|------|------|----------|----------|
| T01 | 微信登录 + 游客模式 + 角色切换 | auth | §3.1.1 | 2026-06-24 |
| T02 | 菜单浏览（分类联动 + 菜品卡片） | menu | §3.1.2 | 2026-06-24 |
| T03 | 规格选择弹窗 + 加价计算 | menu | §3.1.2 | 2026-06-24 |
| T04 | 购物车（弹出层 + 底部栏 + Storage 持久化） | cart | §3.1.3 | 2026-06-24 |
| T05 | 确认订单（配送方式 + 地址/桌号 + 价格汇总） | order | §3.1.4 | 2026-06-24 |
| T06 | 模拟支付 | payment | §3.1.5 | 2026-06-24 |
| T07 | 订单列表 + 详情 + 取消 + 再来一单 | order | §3.1.6 | 2026-06-24 |
| T08 | WebSocket 实时更新（含断线重连） | websocket | §3.1.6 | 2026-06-24 |
| T09 | 商家首页（营收 + 订单列表） | admin | §3.2.1 | 2026-06-24 |
| T10 | 商家订单管理（状态流转 + 接单/拒单） | admin | §3.2.2 | 2026-06-24 |
| T11 | 商家菜品管理（CRUD + 上下架） | admin | §3.2.3 | 2026-06-24 |
| T12 | Supabase RLS 数据隔离 | database | §5.1 | 2026-06-24 |
| T13 | 修复 Supabase 数据库连接问题 | server | §六 | 2026-06-24 |
| T14 | 修复订单表缺少 delivery_fee 字段 | database | §5.1 | 2026-06-24 |
| T15 | 搜索菜品（前端 + 后端 API） | menu | §3.1.2 | 2026-06-24 |
| T16 | 分类管理 CRUD | admin | §3.2.3 | 2026-06-24 |
| T17 | 商家新订单横幅通知 | admin | §3.2.1 | 2026-06-24 |
| T18 | 错误边界（ErrorBoundary） | client | §3.1 | 2026-06-24 |
| T19 | 满减/首单立减促销 | promotion | §3.1.4 | 2026-06-24 |
| T20 | 营业状态切换 | shop | §3.2.1 | 2026-06-24 |
| T21 | 再来一单/取消订单 API | order | §3.1.6 | 2026-06-24 |
| T22 | 热门菜品排行 | menu | §3.1.2 | 2026-06-24 |
| T23 | 预计完成时间 | order | §3.1.6 | 2026-06-24 |
| T24 | 购物车飞入动画 | cart | §3.1.3 | 2026-06-24 |
| T25 | 用户管理（会员列表 + 详情） | admin | §3.2.4 | 2026-06-24 |
| T26 | 规格选项渲染 + 加价计算完善 | menu | §3.1.2 | 2026-06-24 |
| T27 | 微信订阅消息（基础设施） | notification | §3.1 | 2026-06-24 |
| T28 | 菜品图片上传（≤5MB） | storage | §3.2.3 | 2026-06-24 |
| T29 | 骑手角色引入 + 配送闭环 | rider | §3.3 | 2026-06-24 |
| T30 | 堂食/自取流转优化 | order | §3.1.4 | 2026-06-24 |
| T31 | 订单并发控制（月售原子更新） | order | §4.4 | 2026-06-24 |
| T32 | JWT 密钥统一（环境变量） | auth | §4.1 | 2026-06-24 |
| T33 | Supabase 健康检查竞态修复 | server | §六 | 2026-06-24 |
| T34 | WebSocket 重连自动恢复 | websocket | §3.1.6 | 2026-06-24 |
| T35 | 菜单 API 补全 shop_id 校验 | menu | §4.3 | 2026-06-24 |
| T36 | 修复 60+ 个代码错误（客户端 + 服务端） | all | — | 2026-06-25 |
| T37 | 清理 any 类型使用 | all | — | 2026-06-25 |
| T38 | 优化 Supabase N+1 查询 | server | §4.4 | 2026-06-25 |
| T39 | 统一类型定义（Supabase 行类型） | all | — | 2026-06-25 |
| T40 | 补全空 catch 块错误处理 | all | — | 2026-06-25 |
| T41 | 订单创建数据库事务（原子操作） | server | §4.4 | 2026-06-25 |
| T42 | PC 管理后台初始化（React + Ant Design Pro + UMI） | admin-pc | §3.4 | 2026-06-25 |
| T44 | 配送范围设置 | server + admin-pc | §3.5 | 2026-06-25 |
| T45 | 数据可视化 | admin-pc | §3.5 | 2026-06-25 |
| T46 | 多店铺管理 | server + admin-pc | §3.5 | 2026-06-25 |
| T47 | 菜品收藏 | server + client | §3.5 | 2026-06-25 |
| T48 | Token 自动续期 | server + client | §3.5 | 2026-06-25 |
| T49 | 数据看板（营收概览 + 图表） | admin-pc | §3.4 | 2026-06-25 |
| T50 | 店铺管理（信息编辑 + 营业状态 + 配送范围） | admin-pc | §3.4 | 2026-06-25 |
| T51 | 分类管理（CRUD） | admin-pc | §3.4 | 2026-06-25 |
| T52 | 菜品管理（列表 + CRUD + 上下架） | admin-pc | §3.4 | 2026-06-25 |
| T53 | 订单管理（列表 + 状态筛选 + 详情） | admin-pc | §3.4 | 2026-06-25 |
| T54 | 用户管理（会员列表 + 角色筛选） | admin-pc | §3.4 | 2026-06-25 |
| T55 | 促销管理（CRUD） | admin-pc | §3.4 | 2026-06-25 |
| T56 | 客户端路由懒加载（分包） | client | §七 | 2026-06-25 |
| T57 | 服务端 select 字段精简（order/shop/menu） | server | §四 | 2026-06-25 |
| T58 | 前端 API 缓存策略 | client + admin-pc | §七 | 2026-06-25 |
| T59 | 组件 memo 优化 | client + admin-pc | §七 | 2026-06-25 |
| T60 | admin 菜单修复（移除 menuDataRender） | admin-pc | §3.4 | 2026-06-25 |
| T61 | Playwright 管理端自动化测试 | admin-pc | — | 2026-06-25 |
| T62 | 小程序端自动化测试（miniprogram-automator + Jest） | client | — | 2026-06-25 |

---

## 待处理

### 暂缓
| ID | 任务 | 模块 | PRD 关联 | 备注 |
|----|------|------|----------|------|
| T43 | 真实微信支付集成 | payment | §3.5 | 暂缓，需企业资质 |

### 测试用例
| ID | 任务 | 模块 | 说明 | 状态 |
|----|------|------|------|------|
| T63 | Admin 单元测试用例 | admin-pc | 格式工具、API 服务、页面组件 | ✅ done |

### 文档与配置
| ID | 任务 | 模块 | 说明 | 状态 |
|----|------|------|------|------|
| T64 | README.md 项目说明文档 | docs | 项目介绍、启动方式、技术栈 | ✅ done |
| T65 | .env.example 环境变量示例 | server | 环境变量配置模板 | ✅ done |
| T66 | .gitignore 优化 | root | 添加 .env.development/.env.production | ✅ done |

### 部署配置
| ID | 任务 | 模块 | 说明 | 状态 |
|----|------|------|------|------|
| T67 | Dockerfile (server) | server | 后端容器化配置 | ✅ done |
| T68 | Dockerfile (admin) | admin | 管理后台容器化配置 | ✅ done |
| T69 | docker-compose.yml | root | 多服务编排配置 | ✅ done |
| T70 | Nginx 配置 | nginx | 反向代理配置 | ✅ done |

### API 文档
| ID | 任务 | 模块 | 说明 | 状态 |
|----|------|------|------|------|
| T71 | OpenAPI/Swagger 文档 | docs | API 接口文档 | ✅ done |

### CI/CD 与监控
| ID | 任务 | 模块 | 说明 | 状态 |
|----|------|------|------|------|
| T72 | GitHub Actions CI/CD | .github | 自动化测试和部署 | ✅ done |
| T73 | 健康检查端点 | server | /api/health 接口 | ✅ done |

---

## 统计

| 状态 | 数量 |
|------|------|
| ✅ done | 75 |
| ⏳ todo | 0 |
| 🔧 in_progress | 0 |
| 🚫 blocked | 0 |
| 📋 暂缓 | 1 (T43) |
| **总计** | **76** |

---

*最后更新: 2026-06-25*

## 代码优化与重构

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 |
|----|------|------|----------|--------|------|
| T74 | 依赖包版本过时更新 | server + client + admin | §七 | P0 | ⏳ todo |
| T75 | 测试覆盖率提升（39%→70%+） | all | §七 | P0 | ⏳ todo |
| T76 | 购物车Store性能优化（防抖Storage写入） | client | §3.1.3 | P1 | ✅ done |
| T77 | 组件复用性提升（抽取通用组件） | client + admin-pc | §七 | P1 | ⏳ todo |
| T78 | 统一错误处理机制 | all | §七 | P1 | ⏳ todo |
| T79 | 类型安全加强（完善TS类型定义） | all | §七 | P2 | ⏳ todo |
| T80 | 缓存策略优化（智能缓存失效） | client + admin-pc | §七 | P2 | ⏳ todo |

*最后更新: 2026-06-26*

---

## 接口对照分析（2026-06-26）

以下为小程序端每页功能与其后端接口的对照分析结果：

| 页面 | 文件 | 调用的 API | 后端是否存在 | 状态 |
|------|------|-----------|-------------|------|
| 登录页 | `pages/auth/login.tsx` | `POST /auth/wechat-login` | AuthController ✅ | 正常 |
|  | (authStore) | `POST /auth/refresh` | AuthController ✅ | 正常 |
| 菜单页 | `pages/menu/index.tsx` | `GET /shops/:id` | ShopController ✅ | 正常 |
|  |  | `GET /categories` | MenuController ✅ | 正常 |
|  |  | `GET /menu-items` | MenuController ✅ | 正常 |
|  |  | `GET /menu-items/popular` | MenuController ✅ | 正常 |
|  |  | `GET /menu-items/:id/specs` | MenuController ✅ | 正常 |
|  |  | `POST /menu-items/:id/favorite` | MenuController ✅ | ⚠️ 见问题1 |
| 确认订单 | `pages/order-confirm/index.tsx` | `POST /orders` | OrderController ✅ | 正常 |
| 订单详情 | `pages/order-detail/index.tsx` | `GET /orders/:id` | OrderController ✅ | 正常 |
|  |  | `POST /orders/:id/pay` | PaymentController ✅ | 正常 |
|  |  | `POST /orders/:id/status` | OrderController ✅ | 正常 |
| 订单列表 | `pages/order-list/index.tsx` | `GET /orders` (user_id) | OrderController ✅ | 正常 |
| 商家首页 | `pages/admin/index.tsx` | `GET /categories` | MenuController ✅ | 正常 |
|  |  | `GET /orders/stats/:shopId` | OrderController ✅ | 正常 |
|  |  | `GET /orders` (shop_id) | OrderController ✅ | 正常 |
|  |  | `POST /orders/:id/status` | OrderController ✅ | 正常 |
| 菜品管理 | `pages/admin/menu-manage.tsx` | `GET /categories` | MenuController ✅ | 正常 |
|  |  | `GET /menu-items` | MenuController ✅ | 正常 |
|  |  | `POST /menu-items` | MenuController ✅ | 正常 |
|  |  | `PATCH /menu-items/:id` | MenuController ✅ | 正常 |
|  |  | `DELETE /menu-items/:id` | MenuController ✅ | 正常 |
|  |  | `POST /categories` | MenuController ✅ | 正常 |
|  |  | `PATCH /categories/:id` | MenuController ✅ | 正常 |
|  |  | `DELETE /categories/:id` | MenuController ✅ | 正常 |
|  |  | `POST /storage/images/menu` | StorageController ✅ | 正常 |
| 用户管理 | `pages/admin/user-manage.tsx` | `GET /users` | UserController ✅ | 正常 |
| 骑手页 | `pages/rider/index.tsx` | `GET /orders` (is_pool/rider_id) | OrderController ✅ | 正常 |
|  |  | `POST /orders/:id/grab` | OrderController ✅ | 正常 |
|  |  | `POST /orders/:id/deliver` | OrderController ✅ | 正常 |

**结论：所有前端调用的后端接口都存在，无缺失。**

### 质量问题

| ID | 问题 | 模块 | 严重度 | 描述 |
|----|------|------|--------|------|
| Q1 | 收藏功能未持久化到数据库 | server + client | P1 | 菜单页调 `POST /menu-items/:id/favorite` → `MenuController.toggleFavorite()` → `MenuService.toggleFavorite()` 使用内存 `memoryFavorites`(Set)，重启丢失。`FavoritesService` 已有完整 Supabase 持久化，但未被前端使用 |
| Q2 | 菜单页未传 shop_id 过滤菜品 | client | P2 | `GET /menu-items` 无 shop_id 参数 → 返回所有店铺菜品。单店铺时无影响，多店铺时异常 |
| Q3 | 用户管理未分页 | client | P2 | `GET /users` 无 page/pageSize 参数，默认仅返回前 20 条 |
| Q4 | 促销活动前端无展示 | client | P2 | 后端 `GET /promotions` 已实现，但确认订单页未展示可用优惠信息（折扣仅后端自动计算） |
| Q5 | WebSocket 监听器覆盖 | client | P3 | `socket.ts` 中 `onOrderUpdated`/`onOrderCreated` 每次调用 `socket.off()` 再重新注册，后注册的页面会覆盖先前的监听器 |


### Q1-Q4 修复完成（2026-06-26）

| ID | 问题 | 模块 | 严重度 | 状态 | 描述 |
|----|------|------|--------|------|------|
| Q1 | 收藏功能未持久化到数据库 | server | P1 | ✅ done | `MenuService.toggleFavorite` 委托给 `FavoritesService`（Supabase 持久化），Supabase 不可用时回退内存模式 |
| Q2 | 菜单页未传 shop_id 过滤菜品 | client | P2 | ✅ done | `GET /categories`, `GET /menu-items`, `GET /menu-items/popular` 均添加 `shop_id` 参数 |
| Q3 | 用户管理未分页 | client | P2 | ✅ done | `GET /users` 添加 page/pageSize 参数，支持"加载更多" |
| Q4 | 促销活动前端无展示 | client | P2 | ✅ done | 订单确认页新增优惠活动区域，展示满减/首单等可用促销 |
| Q5 | WebSocket 监听器覆盖 | client | P3 | ⏳ todo | socket.ts 中 onOrderUpdated/onOrderCreated 每次 off 后重新注册 |

