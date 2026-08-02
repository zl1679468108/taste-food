# 小买卖点餐系统 — 产品需求文档

> **版本**: 1.0.4<br>
> **更新日期**: 2026-08-01<br>
> **仓库**: `/Users/zhaolong/前端/vibe-coding-project/taste-food`  
> **任务看板**: `docs/tasks.md`（仅含待办/进行中/暂缓计划）  
> **历史归档**: `docs/archive/`（已完成任务快照，如 `tasks-archive-2026-08-01.md`）  
> **开发状态**: ✅ 个人主体可演示上线（全功能完成，仅真实微信支付 T43 因企业资质暂缓）

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
| ✅ 页面级主按钮底部统一 | P2 | T232 | done 2026-07-30 |
| ✅ 多角色切换 | P0 | T201.7 | 顾客/商家/骑手可在端内切换，小程序禁用管理员视角 |
| ✅ 菜单浏览 | P0 | T02, T03, T26, T210.3 | done | 店铺头像支持自定义 Logo，失败回退默认图 |
| ✅ 搜索菜品 | P1 | T15 / T212 | done | 小程序端本地过滤（单店菜单量小，不走后端 search） |
| ✅ 购物车 | P0 | T04, T24 | done |
| ✅ 确认订单 | P0 | T05 | done |
| ✅ 促销活动 | P1 | T19 | done |
| ✅ 模拟/沙箱支付 | P0 | T06, T150 | done |
| ✅ 订单管理 | P0 | T07, T21, T23 / T214 / T219 / T228 | done | 基线：待支付/已支付顾客可自主取消；取消/拒单原因必填（T219）；进度时间轴（T228）。扩展见 §3.20 / T240（催单/申请取消/列表 Tab 等） |

### 3.2 商家端（小程序）✅ 全部完成

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| ✅ 商家首页 | P0 | T09, T17, T20 | done |
| ✅ 订单管理 | P0 | T10 | done |
| ✅ 菜品管理 | P0 | T11, T28 | done |
| ✅ 分类管理 | P1 | T16 | done |
| ✅ 用户管理 | P1 | T25 | done |

### 3.3 骑手端

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| ✅ 抢单 | P0 | T29 | done |
| ✅ 配送确认 | P0 | T29 | done |
| ✅ 送达地理围栏校验 | P1 | T238 | ✅ 2026-07-30 | 默认 500 米（+定位精度缓冲，上限 50 米）；服务端权威校验，客户端预检 |
| ✅ 送达拍照凭证 | P1 | T238 | ✅ 2026-07-30 | 确认送达须**相机拍摄** 1~3 张现场照片；顾客/商家/PC 后台订单详情可查看 |
| ✅ 送达围栏可配置 | P1 | T239 | ✅ 2026-07-30 | 店铺 `deliveryConfirmRadiusM` 默认 500，范围 200~1000 |
| ✅ 强制完成外卖单 | P1 | T239 | ✅ 2026-07-30 | 商家/管理员填原因强制完成；跳过围栏与拍照；凭证+审计可追溯 |
| ✅ 地址坐标治理 | P1 | T239 | ✅ 2026-07-30 | 缺坐标一键完善；不可设默认/下单；确认页拦截提示 |

### 3.4 PC 管理后台 ✅ 基线完成（多店铺统一体验见 §3.18）

| 功能 | 优先级 | 任务 | 状态 |
|------|--------|------|------|
| ✅ 项目初始化 | P3 | T42 | done |
| ✅ 数据看板 | P3 | T49 | done |
| ✅ 店铺管理 | P3 | T50 / T203.2 / T210 | done | 一级菜单；信息/营业时段/桌台整合进编辑；Logo 支持图库上传，未上传/失效回退默认图（见 §3.18） |
| ✅ 分类管理 | P3 | T51 | done | 搜索栏统一见 §3.18 / T200.1 |
| ✅ 菜品管理 | P3 | T52 | done |
| ✅ 订单管理（含待接单实时角标） | P3 | T53 / T245.6 | ✅ 2026-07-31 | PC 后台「已支付/待接单」Tab 实时 Badge，订阅 order:new 即时 +1 |
| ✅ 用户管理 | P3 | T54 / T203.4 | done | 平台管理员创建账号；商家=admin+shop_id；本人可改资料 |
| ✅ 促销管理 | P3 | T55 | done |
| ✅ 导出中心（批量异步导出） | P2 | T267 | ✅ 2026-08-01 | 后台异步生成 Excel（.xlsx，不走 CSV）；任务列表/新建/下载；WebSocket 推送完成通知（详见 §3.21） |

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

**批量异步导出任务**：已于 2026-08-01 实现（T267，详见 §3.21）——PC 端统一仅产出 Excel（.xlsx，不走 CSV）。订单页「后台导出 Excel」与「导出中心」均提交后台异步任务，WebSocket 推送完成通知后于导出中心下载。原同步 `/api/orders/export` 也已强制 `format=xlsx`（拒绝 csv/both），不再产出 CSV。配送轨迹地图已在 §3.17 补齐。

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
| ✅ 订单导出（同步 + 异步） | P2 | T161 / T267 | ✅ 2026-07-24 / ✅ 2026-08-01 | 订单页一键同步导出；「导出中心」后台异步生成 Excel（.xlsx，不走 CSV），支持大批量与完成通知（见 §3.21） |
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
| ✅ 骑手位置上报 | P2 | T164.3 | ✅ 2026-07-24 | 已由 T235 的实时无感定位取代手动上报按钮 |
| ✅ 腾讯地图坐标对齐 | P1 | T211 | ✅ 2026-07-28 | 店铺/地址/订单存 GCJ-02；选点+服务端 geocode；详情地图用真实坐标，无坐标降级 |
| ✅ 骑手配送负载展示 | P1 | T231 | ✅ 2026-07-30 | 顾客在订单完成前可看到骑手实时位置更新时间，以及骑手手上配送中单量 |
| ✅ 骑手实时无感定位 | P1 | T235 | ✅ 2026-07-30 | 骑手端移除手动上报按钮，前台自动持续定位并批量同步；PC 后台 / 小程序商家端 / 顾客端三端实时可见。个人主体无后台定位权限，锁屏或切走小程序即停更 |

### 3.18 多店铺运营与 PC 统一体验 ✅ 2026-07-26

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
| ✅ 店铺 Logo 上传与默认回退 | P1 | T210 | done 2026-07-28 | 后台图库/上传自定义 Logo；空值或 URL 失效时前后台使用默认店铺图标 |
| ✅ 看板统计口径 | P1 | T203.1 | done 2026-07-26 | 近 N 天订单/营收/已完成/状态分布同一时间窗；待处理为当前实时 |
| ✅ 用户账号由管理员创建 | P1 | T203.4 | done 2026-07-26 | 全部账号（含商家）统一 `tf_users`；平台管理员创建；本人可改昵称/头像 |
| ✅ PC 双入口改造（平台端/商家端） | P1 | T300 | done 2026-08-02 | /platform、/merchant 路由分组 + API 前缀 + ShopScope 守卫；后端 tsc 与隔离逻辑断言通过 |
| ✅ 角色-店铺写时不变量 | P1 | T301 | done 2026-08-02 | 禁止再生成 `admin + shop_id` 二义账号：账号管理接口显式 400，登录/切角色路径强制归一；9 项单测守护 |

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
5. **角色枚举**：`merchant` 已作为独立角色落库（T201.1，DB `role` CHECK 已含），商家不再复用 `admin`。
6. **双入口改造（T300）**：将「平台管理员」与「商家」从同一套后台拆为两个入口。前端按角色渲染不同 layout/菜单/路由分组（`/platform/*`、`/merchant/*`）/落地页/顶栏；后端以框架级 `ShopScope` 守卫统一隔离（deny-by-default），平台专属接口走 `/api/platform` 前缀 + `@PlatformOnly`，商家写接口标注 `@MerchantOnly`。
   - 顾客与商家共用的资源接口（`/api/menu/**`、`/api/storage/**`）**刻意保留中性前缀**：GET 是小程序点餐主链路，改前缀会破坏顾客端；隔离改由 `@MerchantOnly` + 强制取 JWT 内 `shopId`（忽略请求体传入的店铺）保证。
7. **角色-店铺写时不变量（T301）**：唯一合法组合为「平台管理员 = `admin` + `shop_id` 空」与「商家 = `merchant` + `shop_id` 非空（一店一商家）」。
   - `admin + shop_id 非空` 的二义账号被禁止：它会让朴素 `role === 'admin'` 判定与 `isPlatformAdmin` 作用域判定得出相反结论，产生越权风险。
   - 存量数据由 migration `v29` 归并为 `merchant`；写入路径由 `assertRoleShopInvariant`（账号管理接口，违规直接 400）与 `normalizeShopIdForRole`（登录/切角色等内部路径，静默归一）双重兜底。
   - 将已绑店账号改为平台管理员时，必须显式传 `shopId: null` 解绑，避免「悄悄摘掉某店商家」导致店铺无人管理。

---

### 3.19 账号注册登录与角色审批 ✅ 2026-07-27

> 关联任务：`T201` 系列。目标：可演示的账号体系 + 商家/骑手审批闭环 + 站内消息。

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 角色模型 merchant + 多角色表 | P0 | T201.1 | done 2026-07-27 | DB CHECK 增 merchant；tf_user_roles；种子测试商家绑定默认店 |
| ✅ 密码注册登录 API（双 Token） | P0 | T201.2 | done 2026-07-27 | username/phone + password；对齐 family-bookkeeping 会话 |
| ✅ 商家/骑手申请与审批 API | P0 | T201.3 | done 2026-07-27 | 申请表、一店一商家、申请前校验店铺占用、驳回重提、审批写角色 |
| ✅ 站内消息通知 | P0 | T201.4 / T245 | done 2026-07-30 | 审批 + 已支付新单 order_paid + 取消申请/结果；消息跳转订单 |
| ✅ PC 登录注册与按角色分流 | P0 | T201.5 | done 2026-07-27 | 登录/注册页；admin/merchant 运营菜单；顾客/骑手轻量中心 |
| ✅ PC 审批中心与消息中心 | P0 | T201.6 | done 2026-07-27 | 管理员审批列表；全角色消息入口 |
| ✅ 小程序登录注册（禁 admin） | P0 | T201.7 | done 2026-07-27 | 微信登录 + 资料；身份申请；角色切换；按角色切 tab；无管理员入口 |
| ✅ 权限守卫 merchant 化 | P0 | T201.8 | done 2026-07-27 | 原商家写接口允许 merchant；平台能力仅 admin |

**要什么（验收）**：
1. Supabase 存在测试商家：`role=merchant`，绑定 `小买卖烧烤`。
2. PC 可注册顾客/申请商家或骑手；管理员可审批；通过后按角色看到对应能力。
3. 小程序仅顾客/商家/骑手；可申请与切换角色；能看消息。
4. 被拒可改资料重提；一店不可有第二商家。
5. 双 Token 登录/刷新可用。



### 3.20 订单流程优化 ✅ 2026-07-30

> 关联任务：`T240` 系列。目标：状态机按配送类型解耦、待支付超时、接单 ETA、催单、申请取消、骑手释放、列表 Tab 与一键拨打。

**状态机**

```
外送: pending_payment → paid → accepted → preparing → ready_for_delivery → delivering → completed
自取/堂食: pending_payment → paid → accepted → preparing → ready_for_pickup → completed
取消: pending_payment/paid（顾客）; pending_payment~ready_for_pickup/ready_for_delivery（商家）
拒单: 仅 paid
```

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 待支付 5 分钟自动取消 | P0 | T240.2 | done 2026-07-30 | 超时系统关单，清理未支付单 |
| ✅ 商家接单后可取消退款 | P0 | T240.1 / T240.2 | done 2026-07-30 | 商家可关单至 ready_for_*；已支付尝试退款（v21 RPC） |
| ✅ 外卖待配送与配送中解耦 | P0 | T240.1 / T240.2 / T240.6 | done 2026-07-30 | `ready_for_delivery` 待抢；仅骑手抢单进入 `delivering` |
| ✅ 接单 ETA | P1 | T240.2 / T240.5 | done 2026-07-30 | `estimatedMinutes` → `estimated_completion` |
| ✅ 顾客催单（10 分钟冷却） | P1 | T240.2 / T240.4 | done 2026-07-30 | `last_urged_at` / `urge_count`；冷却 10 分钟 |
| ✅ 顾客申请取消 + 商家同意/拒绝 | P1 | T240.2 / T240.4 / T240.5 | done 2026-07-30 | `cancel_requested_at` / `cancel_request_reason` |
| ✅ 骑手释放订单回池 | P1 | T240.2 / T240.6 | done 2026-07-30 | 释放后回 `ready_for_delivery`，清空 rider |
| ✅ 顾客/商家退款售后 | P1 | T240.4 / T243 | done 2026-07-30 | 顾客 Tab+详情进度；商家/PC refund Tab、同意退款确认、售后待处理 |
| ✅ 一键拨打商家/骑手 | P1 | T240.4 | done 2026-07-30 | 订单详情拨号入口 |

**要什么（验收口径）**：
1. 外送备餐完成后进入 `ready_for_delivery`，骑手抢单后才 `delivering`；无骑手的历史 `delivering` 可迁移为待抢。
2. 顾客仅可在 `pending_payment`/`paid` 直接取消；接单后走申请取消，商家同意/拒绝。
3. 商家/系统可取消至 `ready_for_delivery`/`ready_for_pickup`（不含已配送中），并触发退款。
4. 拒单仅允许 `paid`。
5. 列表支持 `status=active|history|review|refund|逗号多状态`；`refund`=退款售后（cancelled/rejected 或取消申请中）；详情可催单、申请取消、拨打电话。

### 3.21 批量异步导出（导出中心）✅ 2026-08-01

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 导出任务表与状态机 | P2 | T267.1 | ✅ 2026-08-01 | `tf_export_jobs`（pending→processing→completed/failed），产物存私有桶 export-files |
| ✅ 后台异步生成 Excel | P2 | T267.4 | ✅ 2026-08-01 | 复用订单导出生成 .xlsx（仅 Excel，不走 CSV），不阻塞 HTTP 响应 |
| ✅ 导出中心页面 | P2 | T267.6 | ✅ 2026-08-01 | PC 后台任务列表/新建/下载，WebSocket 推送完成通知 + 轮询兜底 |
| ✅ 订单页接入异步导出 | P2 | T267.7 | ✅ 2026-08-01 | 订单页「后台导出 Excel」提交异步任务，引导至导出中心下载 |
| ✅ 下载鉴权（店铺隔离） | P2 | T267.5 | ✅ 2026-08-01 | 下载端点校验店铺归属；非 completed 返回 409；私有桶不暴露公开直链 |

> 仅产出 Excel（.xlsx），不走 CSV。大批量导出在后台异步完成，完成后通过站内信（WebSocket `notification:new`，type=`export_job`）通知提交人，并在「导出中心」可下载。

---

### 3.22 商家新订单语音播报 ✅ 2026-08-02

> 关联任务：`T266` 系列（见 `docs/archive/tasks-archive-2026-08-01.md`）。
> 场景：后厨/前台不盯屏幕，靠语音第一时间感知新订单与关键事件，降低漏单。

| 功能 | 优先级 | 任务 | 状态 | 说明 |
|------|--------|------|------|------|
| ✅ 后端 TTS 代理（Edge TTS） | P2 | T266.1 | ✅ 2026-08-01 | `POST /api/tts/edge`，Edge TTS WebSocket + `Sec-MS-GEC` DRM 令牌；连续失败 3 次熔断 120s。**当前生产链路未使用**，详见下方「已知差距」 |
| ✅ 预生成语音资产 | P2 | T266.5.2 / T266.7.5 | ✅ 2026-08-02 | `scripts/gen-alert-voice.mjs` 调豆包 seed-tts-2.0（音色「温柔桃子」`zh_female_tianmeitaozi_uranus_bigtts`）离线生成 16 条 MP3，落 `admin/public/sounds/alert/` |
| ✅ 五类事件触发播报 | P2 | T266.6.3–T266.6.6 | ✅ 2026-08-01 | `order_paid` 新订单已付 / `order_cancel_request` 申请取消 / `order_reminder` 顾客催单 / `rider_assigned` 骑手接单 / `new_review` 新评价 |
| ✅ 三级降级播放链 | P2 | T266.5.3 / T266.2 | ✅ 2026-08-01 | ① 预生成 MP3（按话术 djb2 哈希取文件）→ ② 浏览器 `speechSynthesis`（自动挑选中文音色）→ ③ 静态提示音 `new-order.wav`。任一层失败静默降级到下一层 |
| ✅ 话术自选（3 选 1） | P2 | T266.7.1–T266.7.4 | ✅ 2026-08-02 | 每类事件提供 3 条话术候选，商家在「语音播报」页试听并选定；`VOICE_OPTIONS` 为唯一数据源，生成脚本与播放端共用 |
| ✅ PC 配置页与路由 | P2 | T266.7.4 | ✅ 2026-08-02 | `/merchant/voice-alert`（商家端菜单「语音播报」，`access: canMerchant`）；支持逐条试听、保存、恢复默认 |

**要什么（验收口径）**：

1. **触发准确**：仅上述 5 类商家关注事件播报；顾客侧、平台侧不受影响。播报由站内信事件 `notification:new`（WebSocket `/orders` namespace）驱动，非轮询。
2. **不吵**：同一时间窗内连续事件做 800ms 节流，避免高峰期语音叠放糊成一片。
3. **可用性优先**：外部 TTS 不可用、浏览器不支持语音合成、音频加载失败等任一情况下，都要退到「至少响一声」，不允许静默漏播。
4. **话术可选不可编**：商家从预置话术中三选一即可，不开放自由编辑——自由文本需实时 TTS，会引入外部依赖与延迟，与「可用性优先」冲突。
5. **音色统一**：全部预生成语音使用同一音色，避免不同事件音色跳变造成辨识负担。

**已知差距（待办，见 `docs/tasks.md`）**：

- **配置未持久化到后端**：话术选择存浏览器 `localStorage`（按 `voiceAlertConfig:${shopId}` 分桶），换设备/换浏览器/清缓存即丢失，且无法跨店同步 → `T308`（P2）。
- **Edge TTS 模块已下线（T309 ✅ 2026-08-02）**：`server/src/modules/tts/` 源码与 `dist` 陈旧产物已移除，并从 `app.module.ts` 注销注册；生产语音播报统一走豆包预生成 MP3。原"已注册但业务零调用"的隐性死代码已清除。开发期试听页 `new-order-voice-demo.html` 的 `/tts/edge` 调用随之失效（仅历史参考，不影响生产）。
- **无自动播放解锁**：浏览器 autoplay 策略下首次播放可能被拦截，当前仅被动 catch 后降级，未在用户首次交互时主动解锁音频上下文 → `T310`（P2）。
- **配置项偏少**：当前仅话术三选一，无总开关、音量调节、播报重复次数 → `T311`（P3，按需再做）。

---
## 四、API 接口清单

### 4.1 认证
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/wechat-login` | 微信登录，返回 access(`token`)+refresh | 否 |
| POST | `/api/auth/register` | 账号密码注册（默认顾客） | 否 |
| POST | `/api/auth/login` | 账号密码登录，返回双 Token + 角色列表 | 否 |
| POST | `/api/auth/refresh` | 用 refresh 换发新 access（refresh 默认不轮换） | 否 |
| GET | `/api/auth/me` | 当前用户资料与角色列表 | 是 |
| POST | `/api/auth/switch-role` | 切换激活角色（小程序禁 admin） | 是 |
| GET | `/api/role-applications/check-eligibility` | 申请前校验角色资格与商家店铺占用 | 是 |
| GET | `/api/role-applications/mine` | 我的商家/骑手申请记录 | 是 |
| GET/POST | `/api/role-applications` | 管理员查看申请 / 用户提交申请 | 是 |
| PATCH | `/api/role-applications/:id/review` | 管理员审批（通过/驳回） | 是（Admin） |
| GET/PATCH | `/api/notifications` | 站内消息列表/标记已读 | 是 |
> 站内消息 `type` 含：order_paid / order_cancel_request / approved / rejected / order_ready_for_pickup（到店自取就绪）/ notification 等；服务端经 WebSocket `notification:new` 推送到 `user:${userId}` 房间并携带权威 `unreadCount`，前端兜底轮询。

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
| GET | `/api/menu-items` | 菜品列表（支持 `shop_id` + `category_id`；`search` 可选兼容，小程序端改为本地过滤）（响应含 `specs` 规格明细） | 否 |
| GET | `/api/menu-items/popular` | 热门菜品排行 | 否 |
| GET | `/api/menu-items/:id` | 单品详情 | 否 |
| GET | `/api/spec-groups` | 店铺规格组列表（管理端绑定菜品用） | 否 |
| POST | `/api/spec-groups` | 新增规格组（支持 `options` 数组：name + `price_adjust` 分；原子 upsert + 删除未保留项） | 是（Admin） |
| PATCH | `/api/spec-groups/:id` | 编辑规格组（`options` 全量替换） | 是（Admin） |
| DELETE | `/api/spec-groups/:id` | 删除规格组 | 是（Admin） |
| GET | `/api/menu-items/:id/specs` | 菜品规格（兼容保留；列表/详情已内嵌 `specs`） | 否 |
| POST | `/api/categories` | 新增分类 | 是（Admin） |
| PATCH | `/api/categories/:id` | 编辑分类 | 是（Admin） |
| DELETE | `/api/categories/:id` | 删除分类 | 是（Admin） |
| POST | `/api/menu-items` | 新增菜品 | 是（Admin） |
| PATCH | `/api/menu-items/:id` | 编辑菜品 | 是（Admin） |
| DELETE | `/api/menu-items/:id` | 删除菜品 | 是（Admin） |
| PATCH | `/api/menu-items/batch-status` | 批量上下架（body: `ids[]` + `isAvailable` + 可选 `shopId` 校验归属，越权拦截） | 是（Admin） |

### 4.4 订单
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/orders` | 订单列表（分页+筛选；支持 `shop_id`；`status` 支持 `active`/`history`/`review`/`refund` 或逗号多状态；平台跨店 / 商家本店 / 骑手可配送范围） | 是 |
| GET | `/api/orders/stats/:shopId` | 今日营收统计（商家仅本店；平台可指定店） | 是（Admin） |
| GET | `/api/orders/:id` | 订单详情（含 `statusHistory`、ETA/催单/申请取消字段、外卖完成时 `deliveryProof` 送达凭证；`shopAddress` 门店自取地址） | 是 |
| POST | `/api/orders` | 创建订单 | 是 |
| POST | `/api/orders/:id/status` | 更新订单状态（`rejected` 时 `reason` 必填；接单/备餐可传 `estimatedMinutes` 写入 `estimated_completion`） | 是（Admin） |
| POST | `/api/orders/:id/cancel` | 取消订单（顾客：pending_payment/paid；商家/管理员：至 ready_for_delivery/ready_for_pickup；`reason` 必填；已支付尝试退款） | 是 |
| POST | `/api/orders/:id/urge` | 顾客催单（进行中订单；10 分钟冷却；更新 `last_urged_at`/`urge_count`） | 是（顾客本人） |
| POST | `/api/orders/:id/cancel-request` | 顾客申请取消（接单后；写入 `cancel_requested_at`/`cancel_request_reason`） | 是（顾客本人） |
| POST | `/api/orders/:id/cancel-request/resolve` | 商家同意/拒绝取消申请（同意则关单退款） | 是（商家/Admin） |
| POST | `/api/orders/:id/release` | 骑手释放订单回待抢池（`delivering` → `ready_for_delivery`，清空 rider） | 是（Rider/Admin） |
| POST | `/api/orders/:id/reorder` | 再来一单 | 是 |
| POST | `/api/orders/:id/reviews` | 提交订单评价（仅 completed 且本人一次） | 是 |
| GET | `/api/orders/:id/reviews` | 查询订单评价 | 是 |
| POST | `/api/export-jobs` | 提交导出任务（后台异步；body: `entity`(orders) / `status?` / `maxRows?` / `shop_id?`） | 是（Admin/Merchant） |
| GET | `/api/export-jobs` | 导出任务列表（按店铺隔离；分页 `page`/`pageSize`/`status`） | 是（Admin/Merchant） |
| GET | `/api/export-jobs/:id` | 任务详情 | 是（Admin/Merchant） |
| GET | `/api/export-jobs/:id/download` | 下载产物（仅 completed；流式返回 xlsx；校验店铺归属） | 是（Admin/Merchant） |

**列表 `status` 约定（§3.20）**：
- `active`：进行中（pending_payment~delivering/ready_for_*）
- `history`：已结束（completed/cancelled/rejected，兼容旧筛选）
- `refund`（同 `after_sale`）：退款售后（cancelled/rejected，或 `cancel_requested_at` 非空的取消申请中）
- `cancel_request`（同 `after_sale_pending`）：仅售后待处理（`cancel_requested_at` 非空）
- `review`：待评价（completed 且未评价）
- 亦可传逗号分隔多状态，如 `paid,accepted,preparing`

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
| GET | `/api/promotions/conflicts` | 促销时间冲突检测（query: `type`/`startTime`/`endTime`/`excludeId`/`shop_id`；半开区间重叠判定，返回 `hasConflict` + `conflicts`） | 是（Admin） |
| POST | `/api/promotions` | 新增促销 | 是（Admin） |
| PATCH | `/api/promotions/:id` | 编辑促销 | 是（Admin） |
| DELETE | `/api/promotions/:id` | 删除促销 | 是（Admin） |

### 4.7 存储（门店图库）
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/storage/images/delivery-proof` | 骑手上传送达现场照片（form-data: image + orderId + shop_id） | 是（Rider/Admin） |
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
| GET | `/api/platform/audit-logs` | 审计日志分页列表（平台治理专属，仅平台管理员，T300.6） | 是（PlatformAdmin） |

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
| POST | `/api/orders/rider/location` | 骑手批量同步定位到全部配送中订单 | 是（Rider） |

> 配送中外送订单详情 `GET /api/orders/:id` 返回 `riderDeliveryCount`（同一骑手配送中外送单数，含当前单）；`delivery:track` WebSocket 推送同步携带该字段，供顾客端实时刷新。

### 4.13 语音合成（TTS，§3.22）
| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/tts/edge` | Edge TTS 代理，入参 `{ text, voice? }`，返回 `audio/mpeg` MP3 二进制 | 否（`@Public()`） |

> 默认音色 `zh-CN-XiaoxiaoNeural`，输出 `audio-24khz-48kbitrate-mono-mp3`；单次连接超时 8s（→504），WebSocket 异常或无音频返回 503 引导前端降级；连续失败 3 次熔断 120s。
> **注意**：语音播报生产链路已改用预生成 MP3（§3.22），该接口目前仅被开发期试听页 `new-order-voice-demo.html` 调用，去留待 `T309` 决策。

---

## 五、数据库设计

### 5.1 数据表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `tf_shops` | 店铺 | id, name, status, description, address, latitude, longitude, phone, logo_url, delivery_fee, min_order_amount, delivery_range, delivery_confirm_radius_m(200~1000 默认500), business_hours |
| `tf_categories` | 分类 | id, shop_id, name, sort_order, icon_key |
| `tf_menu_items` | 菜品 | id, shop_id, category_id, name, price, monthly_sales, spec_group_ids, status, image_url, description |
| `tf_spec_groups` | 规格组 | id, shop_id, name, is_required, max_select |
| `tf_spec_options` | 规格选项 | id, spec_group_id, name, price_adjust |
| `tf_orders` | 订单 | id, order_no, shop_id, user_id, rider_id, status, total, delivery_fee, delivery_type, address, shop_latitude, shop_longitude, delivery_latitude, delivery_longitude, table_no, contact_name, contact_phone, remark, invoice_needed, invoice_title, invoice_tax_no, estimated_completion, cancel_requested_at, cancel_request_reason, last_urged_at, urge_count |
| `tf_order_status_history` | 订单状态历史 | id, order_id, shop_id, status, from_status, recorded_at（UNIQUE(order_id,status)；用于订单进度各状态完成时间） |
| `tf_order_items` | 订单项 | id, order_id, shop_id, menu_item_id, name, quantity, price, spec_desc, image_url |
| `tf_delivery_info` | 配送/送达凭证 | id, order_id(UNIQUE), shop_id, rider_id, courier_name, courier_phone, estimated_delivery_at, delivered_at, proof_photos(jsonb), confirm_latitude, confirm_longitude, confirm_accuracy, confirm_distance_m, confirm_radius_m, confirm_source(rider/merchant_force/admin_force), force_reason |
| `tf_delivery_tracks` | 配送轨迹点 | id, order_id, shop_id, rider_id, latitude, longitude, speed, accuracy, source, recorded_at |
| `tf_promotions` | 优惠活动 | id, shop_id, name, type, rule, status, start_date, end_date |
| `tf_users` | 用户 | id, openid, user_id, role(`customer`/`admin`/`rider`), shop_id（admin 空=平台管理员，非空=商家单店；rider 不强制；customer 运行时选店）, nick_name, avatar_url |
| `tf_user_sessions` | 登录会话（opaque 双 Token） | id, user_id, token_hash, expires_at, refresh_token_hash, refresh_expires_at, created_at |
| `tf_refresh_tokens` | [Legacy] 旧 JWT refresh 表 | id, token_hash, user_id, expires_at, revoked；1.0.1 起主路径不再写入 |
| `tf_payments` | 支付记录 | id, order_id, shop_id, user_id, amount, method, status, paid_at |
| `tf_favorites` | 菜品收藏 | id, user_id, menu_item_id, shop_id, created_at（UNIQUE(user_id, menu_item_id)） |
| `tf_daily_stats` | 每日销售统计 | id, shop_id, stat_date, total_orders, total_revenue, completed_orders, cancelled_orders（UNIQUE(shop_id, stat_date)） |
| `tf_item_sales` | 菜品销售明细 | id, menu_item_id, shop_id, order_id, order_date, quantity, revenue |
| `tf_addresses` | 顾客地址簿 | id, user_id, shop_id, contact_name, contact_phone, detail, latitude(必填), longitude(必填), tag, is_default, created_at |

> 地址簿与外卖下单：**收货坐标必填**（地图选点 GCJ-02）。无坐标地址不可用于配送；创建外卖订单时服务端校验 `deliveryLatitude/Longitude`，缺失则拒单。
| `tf_audit_logs` | 操作审计日志 | id, shop_id, user_id, role, method, path, action, resource, resource_id, summary, status_code, ip, created_at（展示：动作/摘要/资源/角色中文；时间 `YYYY-MM-DD HH:mm:ss`） |
| `tf_shop_tables` | 店铺桌台 | id, shop_id, table_no, label, sort_order, active, created_at（UNIQUE(shop_id,table_no)） |
| `tf_reviews` | 订单评价 | id, order_id, shop_id, user_id, rating, content, reply_content, reply_at, created_at（UNIQUE(order_id)） |
| `tf_media_assets` | 门店图库素材 | id, shop_id, url, path, file_name, mime, size_bytes, created_at, updated_at（index shop_id） |
| `tf_export_jobs` | 批量异步导出任务 | id, shop_id, user_id, entity(orders), status(pending/processing/completed/failed), format(xlsx), params(jsonb), file_path, file_name, row_count, error_message, created_at, updated_at, completed_at（index shop_id+created_at, user_id, status） |

> `business_hours` 建议结构：`{ mon:[{start,end}], ..., sun:[...] }`，空数组表示当日休息。<br>
> 多租户规范：所有业务表均含 `shop_id` 字段用于店铺隔离。<br>
> 角色与店铺：平台管理员 `role=admin` 且 `shop_id` 为空可跨店查询；商家 `role=merchant` 且绑定单一 `shop_id` 强制单店隔离；骑手跨店取餐不强制 `shop_id`；顾客下单使用当前选中门店写入订单 `shop_id`。<br>
> 可选演进：未来可新增 `super_admin` 枚举，本轮不迁移 DB CHECK。<br>
> `order_no` 规则：`TF + YYYYMMDD + 店铺短码4位 + 当日序号4位`（例 `TF2026072600AB0001`）；旧单可空，展示回退短码。<br>
> 认证会话：Access 默认 2h / Refresh 默认 14d，hash 存 `tf_user_sessions`（对齐 family-bookkeeping，非 JWT）。
> 数据库约束：text 枚举字段（status/delivery_type/role/type/method）均含 CHECK 约束防止非法值；外键含 ON DELETE 行为（CASCADE/RESTRICT/SET NULL）。

### 5.2 订单状态流转

```
外送: pending_payment → paid → accepted → preparing → ready_for_delivery → delivering → completed
自取/堂食: pending_payment → paid → accepted → preparing → ready_for_pickup → completed
取消: pending_payment/paid（顾客）; pending_payment~ready_for_pickup/ready_for_delivery（商家）
拒单: 仅 paid
```

- `ready_for_delivery` — 外卖出餐待抢（delivery 类型，备餐完成、尚无骑手）
- `delivering` — 外卖配送中（仅骑手抢单后进入；与待抢解耦）
- `ready_for_pickup` — 待取餐（pickup/dine_in 类型订单，备餐完成）
- `cancelled` — 顾客仅 `pending_payment`/`paid` 可直接取消；商家/系统可取消至 `ready_for_delivery`/`ready_for_pickup`（不含配送中）；已支付及接单后关单触发退款
- `rejected` — 仅 `paid` 可拒单
- `estimated_completion` — 接单/备餐 ETA（由 `estimatedMinutes` 计算）
- 催单：`last_urged_at` / `urge_count`（默认 10 分钟冷却）
- 申请取消：`cancel_requested_at` / `cancel_request_reason`（商家 resolve 同意则走取消 RPC）

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
| Phase 19 | 多店铺运营与 PC 统一体验 | ✅ | T200（§3.18） |
| Phase 20 | 订单流程优化（状态机/催单/申请取消/列表 Tab） | ✅ | T240（§3.20） |
| Phase 21 | 批量异步导出（导出中心 / 异步 Excel） | ✅ | T267（§3.21） |
| Phase 22 | 商家新订单语音播报（预生成语音 / 三级降级 / 话术自选） | ✅ | T266（§3.22） |
| Phase 23 | 双入口与作用域治理（平台端/商家端拆分 + 角色-店铺不变量） | ✅ | T300 / T301（§3.18） |

---

## 八、上线说明（个人主体）

### 8.1 可上线范围
- 顾客：菜单浏览 → 下单 → 沙箱支付 → 订单跟踪 → 评价 → 我的评价记录（切换门店能力见 §3.18 / T200.7）
- 商家：接单 / 备餐 / 状态推进（单店绑定语义深化见 T200.5）
- 骑手：抢单 / 轨迹上报（旧库无表时内存） / 确认送达（跨店取餐见 T200.6）
- 管理后台与小程序商家端可联调演示（PC 店铺上下文/搜索统一/审计中文见 T200）

### 8.2 已知限制
1. **真实微信支付（T43）** 暂缓，需企业商户号；当前默认 `PAYMENT_PROVIDER=sandbox`。
2. **线上 Supabase schema（已由 T181 对齐，2026-08-01）**：`order_no` / `tf_user_sessions` 已在 1.0.1 执行并回并 `database-init.sql`；T181 进一步执行 `v22`–`v27` 迁移补齐线上库漂移缺列（`tf_orders.cancel_reason`/`reject_reason`、`tf_delivery_info` 5 列、`tf_users` 2 列）与三处 `shop_id` 外键。服务端兼容回退逻辑保留作防御性兜底，但生产库已与 `database-init.sql` 对齐。
3. **骑手归属（已解决，T181）**：`rider_id` 已随 T181 schema 对齐落地于 `tf_orders`/`tf_delivery_info`/`tf_delivery_tracks`，抢单归属持久化，重启后历史单骑手归属完整；仅未迁移的历史库仍受限。
4. **daily_stats 聚合（已解决）**：`database-init.sql` 已含 `tf_daily_stats` 表与 `atomic_update_daily_stats` RPC，状态流转 RPC（`atomic_update_order_status` 等）在事务内联动写入预聚合表；`v18`/`v21`/`v22` 均已执行。聚合口径完整，无弱于完整版的限制。
5. **多店铺角色语义（§3.18）**：现行模型为「平台管理员 = `admin` + `shop_id` 空 / 商家 = `merchant` + `shop_id` 非空」。`merchant` 已是独立角色枚举（T201.1），商家不再复用 `admin`；`admin + shop_id 非空` 的二义账号已由 `v29` 归并，并经 T301 在写入路径封堵。不强制新增 `super_admin` 枚举迁移。
6. **批量异步导出（T267）** `docs/migrations/v28-export-jobs.sql` 已于 2026-08-02 在线上 Supabase 执行（已建 `tf_export_jobs` 表）；导出文件存私有桶 `export-files`，无 Supabase 时回退内存模式（不持久化，重启即失）。
7. **微信订阅消息（T304 ✅ 显式暂缓，2026-08-02）**：`NotificationModule`/`NotificationService` 源码已移除，`app.module.ts` 注销注册，全仓零业务调用。订阅消息能力保留为显式暂缓决策——依赖微信模板 ID 配置，待企业主体认证（T43）完成后再评估接线；当前新订单/订单状态变更以站内信（inbox）为主渠道。
8. **Edge TTS 端点（T309 ✅ 下线，2026-08-02）**：旧 `POST /api/tts/edge`（Edge TTS WebSocket）已从后端移除并注销模块；语音播报统一采用豆包预生成 MP3。开发期试听页 `new-order-voice-demo.html` 的该端点调用随之失效。

### 8.3 验收证据（2026-07-25）
- 全链路冒烟：create → pay → accepted → preparing → grab → delivery-track → deliver → review = **SMOKE_OK**
- server unit tests：**53/53**
- `npm run quality:check`：**all checks passed**
