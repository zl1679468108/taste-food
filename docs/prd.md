# 小买卖点餐系统 — 产品需求文档

> **版本**: 1.0.3<br>
> **更新日期**: 2026-07-26<br>
> **仓库**: `/Users/zhaolong/前端/vibe-coding-project/taste-food`  
> **任务看板**: `docs/tasks.md`  
> **开发状态**: ✅ 个人主体约 90% 可演示上线；✅ 多店铺运营与 PC 统一体验改造已落地（§3.18 / T200）

---

## 一、项目概述

面向线下小餐饮店的**扫码点餐微信小程序系统**，覆盖从浏览菜单到订单完成的完整交易闭环。

**AppID**: `wx93c16508eff05096`（个人主体）

---

## 二、用户角色

### 2.1 业务角色

| 角色 | 代码值 | shop_id | 说明 | 入口 |
|------|--------|---------|------|------|
| 平台管理员 | `admin` | 空 | 平台治理：跨店数据、审批商家/骑手申请、用户与审计 | PC 管理后台 |
| 商家 | `merchant` | **必填（一店一商家）** | 单店运营：接单、菜品、促销、桌台、本店数据 | PC（商家菜单）/ 小程序商家端 |
| 骑手 | `rider` | 空 | 跨店抢单/配送；需审批通过后生效 | 小程序骑手端 / PC 轻量中心 |
| 顾客 | `customer` | 空 | 浏览菜单、下单、收藏、地址；可申请成为商家/骑手 | 小程序 / PC 轻量中心 |
| 游客 | — | — | 未登录浏览菜单 | 小程序「先逛逛」 |

### 2.2 一账号多角色

- 用户可同时拥有多个已生效角色（如顾客+骑手），登录后可切换当前角色。
- `tf_users.role` 表示**当前激活角色**；全部角色存 `tf_user_roles`。
- 切换角色后 Token 会话绑定当前角色与（商家时的）`shop_id`。
- 小程序**不允许**激活 `admin`；PC 全角色可登录，按角色分流菜单。

### 2.3 注册与审批

| 申请角色 | 注册时 | 审批 | 通过后 |
|----------|--------|------|--------|
| 顾客 | 直接生效 | 否 | `customer` |
| 商家 | 先落 `customer`，提交商家申请 | 管理员审批 | `merchant` + 绑定/创建店铺（一店一商家） |
| 骑手 | 先落 `customer`（若无），提交骑手申请 | 管理员审批 | 增加 `rider` 角色 |
| 管理员 | 不可自助注册 | — | 仅种子/运维创建 |

- 被拒后可修改申请信息重新提交（同一用户同一申请类型仅允许一条 `pending`）。
- 站内消息通知：提交成功、通过、驳回（含原因）。

### 2.4 双 Token（对齐 family-bookkeeping）

- 非 JWT；Access ~2h + Refresh ~14d；hash 存 `tf_user_sessions`。
- PC 账号密码登录与小程序微信登录共用同一会话模型。


## 三、功能清单

### 3.1 顾客端 ✅ 全部完成

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| ✅ 微信登录 | P0 | T01 | done |
| ✅ 我的页 / 退出登录 | P1 | T188 | done 2026-07-26 |
| ❌ 角色切换（已移除） | — | T189 | 一账号一身份，不提供端内切换 |
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

### 3.4 PC 管理后台 ✅ 基线完成（多店铺统一体验见 §3.18）

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| ✅ 项目初始化 | P3 | T42 | done |
| ✅ 数据看板 | P3 | T49 | done |
| ✅ 店铺管理 | P3 | T50 / T203.2 | done | 一级菜单；信息/营业时段/桌台整合进编辑（见 §3.18） |
| ✅ 分类管理 | P3 | T51 | done | 搜索栏统一见 §3.18 / T200.1 |
| ✅ 菜品管理 | P3 | T52 | done |
| ✅ 订单管理 | P3 | T53 | done |
| ✅ 用户管理 | P3 | T54 / T203.4 | done | 平台管理员创建账号；商家=admin+shop_id；本人可改资料 |
| ✅ 促销管理 | P3 | T55 | done |

### 3.5 P3 功能完善 ✅ 全部完成

| 功能 | 优先级 | 任务 | 状态 | 完成日期 |
|------|--------|------|------|----------|
| ✅ 配送范围设置 | P3 | T44 | done | 2026-06-25 |
| ✅ 多店铺管理（基线） | P3 | T46 | done | 2026-06-25 | 店铺 CRUD 基线；跨店角色与运营隔离深化见 §3.18 |
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
| ✅ 我的评价记录 | P2 | T202 | ✅ 2026-07-26 | 顾客查看本人已评价订单列表（含商家回复） |
| ✅ 通用弱网/错误重试/空态引导 | P2 | T155 | ✅ 2026-07-24 | 请求失败可重试、弱网提示、空态 CTA |
| ✅ 下单备注与发票信息 | P2 | T156 | ✅ 2026-07-24 | 订单备注、是否开票、抬头/税号；商家与 admin 可见 |
| ✅ 小程序全局样式变量统一 | P1 | T194 | ✅ 2026-07-26 | 字体/字号/颜色/间距/行高 design tokens，模块 scss 去硬编码 |
| ✅ 样式变量落地验收与 PC 对齐 | P1 | T195 | ✅ 2026-07-26 | 小程序文字层级验收；admin theme/CSS 变量对齐 client tokens |
| ✅ 视觉验收与 quality 全绿 | P1 | T197 | ✅ 2026-07-26 | 文字层级验收；过期单测；admin 场景色；quality:check 9/9 |

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


### 3.16 操作审计日志 ✅ 2026-07-24（展示中文化见 §3.18）

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 商家写操作审计 | P2 | T163 | ✅ 2026-07-24 | 自动记录 Admin 写接口；后台可查询 |
| ✅ 审计展示中文化 | P1 | T200.2 | done 2026-07-26 | 动作/摘要/资源/角色中文展示；时间 `YYYY-MM-DD HH:mm:ss` |


### 3.17 配送轨迹地图 ✅ 2026-07-24

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 配送轨迹持久化 | P2 | T164.1 | ✅ 2026-07-24 | 记录骑手经纬度、速度、精度与上报时间 |
| ✅ 顾客订单详情地图 | P2 | T164.2 | ✅ 2026-07-24 | 外卖订单展示地图、路线、骑手当前位置与更新时间 |
| ✅ 骑手位置上报 | P2 | T164.3 | ✅ 2026-07-24 | 骑手配送中可上报位置；开发环境支持演示坐标兜底 |

### 3.18 多店铺运营与 PC 统一体验 ✅ 2026-07-26 进行中

> 关联任务：`T200` 系列（见 `docs/tasks.md`）。本轮以「`admin` 跨店（`shop_id` 空）vs 商家单店」为主方案；`super_admin` 仅作可选演进，不强制迁移。

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ PC 列表搜索栏统一 | P1 | T200.1 | done 2026-07-26 | 统一为菜品列表风格 `SearchFilterBar`：圆角搜索框 + 橙色搜索按钮 + 可选筛选；分类管理等仍用 ProTable 查询表单的页面一并改造 |
| ✅ 操作审计展示中文化 | P1 | T200.2 | done 2026-07-26 | 动作/摘要/资源/角色中文；时间格式 `YYYY-MM-DD HH:mm:ss` |
| ✅ PRD 多店铺角色模型 | P1 | T200.3 | done 2026-07-26 | 平台管理员/商家/骑手/顾客数据范围与代码枚举映射写入 PRD |
| ✅ Admin 全局店铺上下文 | P1 | T200.4 | done 2026-07-26 | PC 顶栏/全局选择当前店铺（或全部）；业务页按店过滤；菜单围绕店铺业务 |
| ✅ 后端跨店查询与单店隔离 | P1 | T200.5 | done 2026-07-26 | 平台管理员可跨店查询/筛选；商家 `admin+shop_id` 强制单店隔离 |
| ✅ 骑手跨店取餐 | P1 | T200.6 | done 2026-07-26 | 骑手可从多店抢单/取餐，不强制绑定单一 `shop_id` |
| ✅ 顾客切换门店下单 | P1 | T200.7 | done 2026-07-26 | 顾客可切换门店；购物车/下单/菜单上下文跟随当前门店 |
| ✅ 店铺菜单整合 | P1 | T203.2 | done 2026-07-26 | 「店铺管理」一级菜单；店铺信息/营业时段并入编辑；桌台与扫码在编辑侧抽屉 |
| ✅ 看板统计口径 | P1 | T203.1 | done 2026-07-26 | 近 N 天订单/营收/已完成/状态分布同一时间窗；待处理为当前实时 |
| ✅ 用户账号由管理员创建 | P1 | T203.4 | done 2026-07-26 | 全部账号（含商家）统一 `tf_users`；平台管理员创建；本人可改昵称/头像 |

**要什么（验收口径）**：

1. **搜索体验一致**：PC 业务列表（至少：菜品、分类、订单、用户、促销、审计等）搜索区视觉与交互统一为 `SearchFilterBar`，避免部分页 ProTable 查询表单、部分页自定义条并存。
2. **审计可读**：后台审计列表不直接暴露生硬英文枚举/路径；动作、摘要、资源、角色中文化；创建时间统一 `YYYY-MM-DD HH:mm:ss`。
3. **店铺上下文**：
   - 平台管理员：默认可看全部，可按店铺筛选/切换；看板与列表均支持店维度。
   - 商家：登录后锁定绑定店铺，不可越权读写其他店。
   - PC 侧菜单与页面以店铺运营为主线（订单/菜品/分类/促销/桌台/图库/审计等均带店隔离或店筛选）。
4. **角色数据范围**（与 §2 一致）：
   - 平台管理员跨店只读/治理能力与商家单店写能力边界清晰。
   - 骑手跨店取餐；顾客切换门店后下单，订单写入对应 `shop_id`。
5. **兼容**：不要求本轮修改 DB `role` CHECK；通过 `role=admin` + `shop_id` 空/非空区分平台管理员与商家。

---

### 3.19 账号注册登录与角色审批 🔄 2026-07-26

> 关联任务：`T201` 系列。目标：可演示的账号体系 + 商家/骑手审批闭环 + 站内消息。

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| 🔄 角色模型 merchant + 多角色表 | P0 | T201.1 | todo | DB CHECK 增 merchant；tf_user_roles；种子测试商家绑定默认店 |
| 🔄 密码注册登录 API（双 Token） | P0 | T201.2 | todo | username/phone + password；对齐 family-bookkeeping 会话 |
| 🔄 商家/骑手申请与审批 API | P0 | T201.3 | todo | 申请表、一店一商家、驳回重提、审批写角色 |
| 🔄 站内消息通知 | P0 | T201.4 | todo | tf_notifications；列表/已读；审批结果推送 |
| 🔄 PC 登录注册与按角色分流 | P0 | T201.5 | todo | 登录/注册页；admin/merchant 运营菜单；顾客/骑手轻量中心 |
| 🔄 PC 审批中心与消息中心 | P0 | T201.6 | todo | 管理员审批列表；全角色消息入口 |
| 🔄 小程序登录注册（禁 admin） | P0 | T201.7 | todo | 微信登录 + 资料；身份申请；角色切换；无管理员入口 |
| 🔄 权限守卫 merchant 化 | P0 | T201.8 | todo | 原商家写接口允许 merchant；平台能力仅 admin |

**要什么（验收）**：
1. Supabase 存在测试商家：`role=merchant`，绑定 `小买卖烧烤`。
2. PC 可注册顾客/申请商家或骑手；管理员可审批；通过后按角色看到对应能力。
3. 小程序仅顾客/商家/骑手；可申请与切换角色；能看消息。
4. 被拒可改资料重提；一店不可有第二商家。
5. 双 Token 登录/刷新可用。


## 四、API 接口清单

### 4.1 认证
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/wechat-login` | 微信登录，返回 access(`token`)+refresh | 否 |
| POST | `/api/auth/register` | 账号密码注册（默认顾客；可选提交申请意向） | 否 |
| POST | `/api/auth/login` | 账号密码登录，返回双 Token + 角色列表 | 否 |
| POST | `/api/auth/refresh` | 用 refresh 换发新 access（refresh 默认不轮换） | 否 |
| GET | `/api/auth/me` | 当前用户资料与角色列表 | 是 |
| POST | `/api/auth/switch-role` | 切换激活角色（小程序禁 admin） | 是 |
| GET/POST | `/api/role-applications` | 提交/查看我的商家或骑手申请 | 是 |
| GET/PATCH | `/api/role-applications/:id` | 管理员审批（通过/驳回） | 是（Admin） |
| GET/PATCH | `/api/notifications` | 站内消息列表/标记已读 | 是 |

**Token 方案（对齐 family-bookkeeping）**：
- **不使用 JWT**；不透明双 Token（Access 默认 2h + Refresh 默认 14d）
- Access / Refresh 均 SHA-256 hash 存 `tf_user_sessions`，可服务端吊销
- 请求头：`Authorization: Bearer <accessToken>`
- 字段兼容：接口仍返回 `token`（access）+ `refreshToken`

### 4.2 店铺
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/shops/:id` | 获取店铺信息 | 否 |
| GET | `/api/shops` | 获取所有店铺（顾客切换门店、平台筛选数据源） | 否 |
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

**多店铺鉴权约定（§3.18）**：
- 标注「是（Admin）」的写接口：商家（`admin` + 绑定 `shop_id`）仅可操作本店资源；平台管理员（`admin` + `shop_id` 空）可指定/切换目标店铺后操作。
- 列表类读接口应支持 `shop_id` 筛选；平台管理员可不传以查看全部（或显式 `shop_id`）；商家缺省强制本店。

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
| GET | `/api/orders` | 订单列表（分页+筛选；支持 `shop_id`；平台跨店 / 商家本店 / 骑手可配送范围） | 是 |
| GET | `/api/orders/stats/:shopId` | 今日营收统计（商家仅本店；平台可指定店） | 是（Admin） |
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

### 4.7 存储（门店图库）
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/storage/images/menu` | 单张上传菜品图片（form: `image` + `shop_id`，≤5MB，jpg/png/webp） | 是（Admin） |
| POST | `/api/storage/images/menu/batch` | 批量上传（form: `images` 多文件 + `shop_id`，≤30 张） | 是（Admin） |
| GET | `/api/storage/images/menu?shop_id=` | 门店图库列表（含 `usedBy` 菜品占用） | 是（Admin） |
| DELETE | `/api/storage/images/menu/:id` | 按素材 id 删除（仍被菜品引用则 400） | 是（Admin） |
| DELETE | `/api/storage/images/:path` | [兼容] 按 storage path 删除对象 | 是（Admin） |

> 存储路径约定：`{shopId}/{timestamp}-{rand}.ext`，桶 `menu-images`；上传成功写入 `tf_media_assets`。

### 4.8 用户
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/users` | 会员/账号列表（分页；支持 `role`、`shop_id` 筛选） | 是（Admin） |
| GET | `/api/users/:id` | 会员/账号详情 | 是（Admin） |

**角色字段约定（§2 / §3.19）**：
- DB `role` CHECK：`customer | admin | rider | merchant`
- 平台管理员：`admin` + `shop_id` 空；商家：`merchant` + 必填 `shop_id`（一店一商家）
- 骑手/顾客：`shop_id` 空；多角色见 `tf_user_roles`；当前激活角色写在 `tf_users.role`

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
| GET | `/api/audit-logs` | 审计日志分页列表（支持 `shop_id` 等筛选） | 是（Admin） |

**展示约定（§3.18 / T200.2）**：
- 列表需提供中文可读字段（或前端映射）：动作、摘要、资源、角色
- 时间展示格式：`YYYY-MM-DD HH:mm:ss`
- 商家仅本店审计；平台管理员可跨店查看/按店筛选

### 4.10 评价列表（体验增强）
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/reviews/mine` | 顾客本人评价列表（分页） | 是（登录用户） |
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
| `tf_orders` | 订单 | id, order_no, shop_id, user_id, rider_id, status, total, delivery_fee, delivery_type, address, table_no, contact_name, contact_phone, remark, invoice_needed, invoice_title, invoice_tax_no |
| `tf_order_items` | 订单项 | id, order_id, shop_id, menu_item_id, name, quantity, price, spec_desc, image_url |
| `tf_delivery_info` | 配送信息 | id, order_id, shop_id, courier_name, courier_phone, estimated_delivery_at, delivered_at |
| `tf_delivery_tracks` | 配送轨迹点 | id, order_id, shop_id, rider_id, latitude, longitude, speed, accuracy, source, recorded_at |
| `tf_promotions` | 优惠活动 | id, shop_id, name, type, rule, status, start_date, end_date |
| `tf_users` | 用户 | id, openid, user_id, role(`customer`/`admin`/`rider`), shop_id（admin 空=平台管理员，非空=商家单店；rider 不强制；customer 运行时选店）, nick_name, avatar_url |
| `tf_user_sessions` | 登录会话（opaque 双 Token） | id, user_id, token_hash, expires_at, refresh_token_hash, refresh_expires_at, created_at |
| `tf_refresh_tokens` | [Legacy] 旧 JWT refresh 表 | id, token_hash, user_id, expires_at, revoked；1.0.1 起主路径不再写入 |
| `tf_payments` | 支付记录 | id, order_id, shop_id, user_id, amount, method, status, paid_at |
| `tf_favorites` | 菜品收藏 | id, user_id, menu_item_id, shop_id, created_at（UNIQUE(user_id, menu_item_id)） |
| `tf_daily_stats` | 每日销售统计 | id, shop_id, stat_date, total_orders, total_revenue, completed_orders, cancelled_orders（UNIQUE(shop_id, stat_date)） |
| `tf_item_sales` | 菜品销售明细 | id, menu_item_id, shop_id, order_id, order_date, quantity, revenue |
| `tf_addresses` | 顾客地址簿 | id, user_id, shop_id, contact_name, contact_phone, detail, tag, is_default, created_at |
| `tf_audit_logs` | 操作审计日志 | id, shop_id, user_id, role, method, path, action, resource, resource_id, summary, status_code, ip, created_at（展示：动作/摘要/资源/角色中文；时间 `YYYY-MM-DD HH:mm:ss`） |
| `tf_shop_tables` | 店铺桌台 | id, shop_id, table_no, label, sort_order, active, created_at（UNIQUE(shop_id,table_no)） |
| `tf_reviews` | 订单评价 | id, order_id, shop_id, user_id, rating, content, reply_content, reply_at, created_at（UNIQUE(order_id)） |
| `tf_media_assets` | 门店图库素材 | id, shop_id, url, path, file_name, mime, size_bytes, created_at, updated_at（index shop_id） |

> `business_hours` 建议结构：`{ mon:[{start,end}], ..., sun:[...] }`，空数组表示当日休息。<br>
> 多租户规范：所有业务表均含 `shop_id` 字段用于店铺隔离。<br>
> 角色与店铺：平台管理员 `role=admin` 且 `shop_id` 为空可跨店查询；商家 `role=admin` 且绑定单一 `shop_id` 强制单店隔离；骑手跨店取餐不强制 `shop_id`；顾客下单使用当前选中门店写入订单 `shop_id`。<br>
> 可选演进：未来可新增 `super_admin` 枚举，本轮不迁移 DB CHECK。<br>
> `order_no` 规则：`TF + YYYYMMDD + 店铺短码4位 + 当日序号4位`（例 `TF2026072600AB0001`）；旧单可空，展示回退短码。<br>
> 认证会话：Access 默认 2h / Refresh 默认 14d，hash 存 `tf_user_sessions`（对齐 family-bookkeeping，非 JWT）。
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
│  顾客：选店/切换门店 → 菜单 → 下单 → 订单/轨迹    │
│  商家：单店运营（首页/订单/菜品/用户）             │
│  骑手：跨店抢单 / 取餐 / 确认送达                 │
│  Zustand + Storage + ErrorBoundary               │
└──────────────────┬──────────────────────────────┘
                   │  shop_id 上下文 / 角色鉴权
┌──────────────────┼──────────────────────────────┐
│           NestJS 后端 (Port 3010)                 │
│  Auth → Shop → Menu → Order → Payment            │
│  Promotion → Storage → User → Audit → Notification│
│  平台管理员跨店查询 / 商家单店隔离 / 骑手跨店订单  │
│  WebSocket Gateway / Supabase (PostgreSQL)       │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────┐
│        PC 管理后台 (Port 3012)                    │
│  React + Ant Design Pro + UMI                    │
│  全局店铺上下文 + SearchFilterBar 统一列表搜索    │
│  Dashboard / Shop / Menu / Order / User / Promo  │
│  Audit（中文展示）— 业务数据按 shop 隔离/筛选     │
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
| Phase 19 | 多店铺运营与 PC 统一体验 | 🔄 | T200（§3.18） |

---

## 八、上线说明（个人主体）

### 8.1 可上线范围
- 顾客：菜单浏览 → 下单 → 沙箱支付 → 订单跟踪 → 评价 → 我的评价记录（切换门店能力见 §3.18 / T200.7）
- 商家：接单 / 备餐 / 状态推进（单店绑定语义深化见 T200.5）
- 骑手：抢单 / 轨迹上报（旧库无表时内存） / 确认送达（跨店取餐见 T200.6）
- 管理后台与小程序商家端可联调演示（PC 店铺上下文/搜索统一/审计中文见 T200）

### 8.2 已知限制
1. **真实微信支付（T43）** 暂缓，需企业商户号；当前默认 `PAYMENT_PROVIDER=sandbox`。
2. **线上 Supabase schema**：`order_no` / `tf_user_sessions` 已在 1.0.1 执行并回并 `database-init.sql`；其余旧库缺口（如部分 `atomic_*`、历史缺列）仍靠服务端兼容回退，完整对齐见 T181。
3. 旧库无 `rider_id` 时抢单归属仅进程内有效；重启后历史单骑手归属不完整。
4. daily_stats 等依赖 RPC 的聚合在旧库可能弱于完整版。
5. **多店铺角色语义（§3.18）**：产品已定义「平台管理员 = admin + shop_id 空 / 商家 = admin + 单店」；实现与 PC 统一体验改造进行中（T200），本轮不强制新增 `super_admin` 枚举迁移。

### 8.3 验收证据（2026-07-25）
- 全链路冒烟：create → pay → accepted → preparing → grab → delivery-track → deliver → review = **SMOKE_OK**
- server unit tests：**53/53**
- `npm run quality:check`：**all checks passed**
