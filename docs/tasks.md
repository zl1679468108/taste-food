# 任务看板

> **唯一状态源** — 仅维护当前待办、进行中、阻塞与将来/暂缓事项  
> **状态**: `todo` → `in_progress` → `done` | `blocked`  
> **关联**: 每条任务链接到 `prd.md` 对应章节  
> **需求文档**: `docs/prd.md`

---

## 当前待办

### P1 — 旧库 schema 漂移兼容与上线冒烟（T180）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T180.1 | 订单状态/取消 RPC 缺失直更回退 | server | §4.4 / §5.1 / §6 | P1 | ✅ done 2026-07-25 | atomic_update_order_status / atomic_cancel_order 缺失时直更 tf_orders，保留状态校验与 WS 推送 |
| T180.2 | 沙箱支付缺 RPC 时落库支付+改状态 | server | §4.5 / §6 | P1 | ✅ done 2026-07-25 | atomic_pay_order 缺失时渐进写入 tf_payments 并 updateStatus→paid |
| T180.3 | 抢单/送达/轨迹旧库兼容 | server | §4.4 / §3.12 / §6 | P1 | ✅ done 2026-07-25 | rider_id 缺列内存归属；tf_delivery_tracks 缺表内存轨迹；骑手权限兼容 delivering 外送单 |
| T180.4 | 全链路冒烟与质量门禁验收 | 部署 | §3.10 / §6 | P1 | ✅ done 2026-07-25 | create→pay→accept→prepare→grab→track→deliver→review 通过；server 53/53；quality:check 全绿 |

### P2 — server 促销服务测试与生效窗口修复（T179）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T179.1 | 促销 CRUD 与生效窗口测试 | server | §4.6 / §6 | P2 | ✅ done 2026-07-25 | 覆盖 active/status、startDate/endDate、店铺筛选、更新删除与 404 |
| T179.2 | 订单促销折扣计算测试 | server | §4.4 / §4.6 / §6 | P2 | ✅ done 2026-07-25 | 覆盖满减最大优惠、未来活动不提前生效、首单优惠仅首单 |


### P2 — server 门店服务测试与免配送费修复（T178）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T178.1 | 门店创建/营业时段测试 | server | §3.12 / §4.2 / §6 | P2 | ✅ done 2026-07-25 | 覆盖免配送费保留、营业时段规范化、营业状态与可下单标记 |
| T178.2 | 门店更新/开关/删除测试 | server | §3.12 / §4.2 / §6 | P2 | ✅ done 2026-07-25 | 覆盖营业时段非法值、开关店、开放店铺筛选、删除后 404 |


### P2 — server 桌台服务测试与校验补强（T177）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T177.1 | 桌台 seed/list/create 测试 | server | §3.14 / §4.2 / §6 | P2 | ✅ done 2026-07-25 | 覆盖默认 A01-A10、启用筛选、scanPath、排序与重复桌号 |
| T177.2 | 桌台 update/delete 校验测试 | server | §3.14 / §4.2 / §6 | P2 | ✅ done 2026-07-25 | 覆盖更新字段、空白桌号拒绝、跨店/缺失桌台 404 与删除 |


### P2 — server 审计日志服务测试（T176）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T176.1 | 审计写入与字段规范测试 | server | §3.16 / §4.11 / §6 | P2 | ✅ done 2026-07-25 | 覆盖内存回退写入、长字段截断、新日志倒序 |
| T176.2 | 审计列表筛选与容量测试 | server | §3.16 / §4.11 / §6 | P2 | ✅ done 2026-07-25 | 覆盖 shop/method/action 筛选、分页边界、内存上限 |


### P2 — server 评价服务测试（T175）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T175.1 | 评价提交与查询测试 | server | §3.12 / §4.10 / §6 | P2 | ✅ done 2026-07-25 | 覆盖 completed 本人提交、非本人/未完成/重复/非法载荷拒绝、查询本人评价 |
| T175.2 | 评价列表与商家回复测试 | server | §3.15 / §4.10 / §6 | P2 | ✅ done 2026-07-25 | 覆盖店铺筛选分页、商家回复、缺失评价/空回复/跨店回复拒绝 |


### P2 — server 地址簿服务测试（T174）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T174.1 | 地址簿默认地址与筛选测试 | server | §3.12 / §4.9 / §6 | P2 | ✅ done 2026-07-25 | 覆盖首条默认、默认互斥、删除默认迁移、按店铺筛选 |
| T174.2 | 地址簿用户隔离与校验测试 | server | §3.12 / §4.9 / §6 | P2 | ✅ done 2026-07-25 | 覆盖跨用户访问/删除拒绝、空字段更新拒绝、缺失地址 404 |


### P2 — 统一质量门禁脚本（T173）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T173.1 | 根级质量门禁脚本 | 部署 | §3.10 / §6 | P2 | ✅ done 2026-07-25 | npm run quality:check 串联 shared/server/client/admin typecheck/test/build；typecheck 固定使用各 workspace 本地 tsc，避免 npx 占位包误报；本地全量通过 |
| T173.2 | CI 复用质量门禁 | 部署 | §3.10 / §6 | P2 | ✅ done 2026-07-25 | GitHub Actions 改为调用统一 quality gate，减少本地/CI 漂移 |


### P2 — server 下单核价与门店约束测试（T172）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T172.1 | 下单服务端核价测试 | server | §4.4 / §5.1 / §6 | P2 | ✅ done 2026-07-25 | 覆盖忽略客户端价格、规格加价、非法规格拒绝 |
| T172.2 | 门店与配送约束测试 | server | §4.4 / §5.1 / §6 | P2 | ✅ done 2026-07-25 | 覆盖配送费、起送价、关店/非营业、外送地址与堂食桌号必填 |


### P2 — server 测试输出降噪（T171）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T171.1 | server 测试 setup 降噪 | server | §3.6 / §6 | P2 | ✅ done 2026-07-25 | 测试进程静音 Nest 正常日志与预期 Supabase 内存回退提示；npm test 输出干净 |


### P2 — server 支付与订单状态测试（T170）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T170.1 | 沙箱支付服务测试 | server/payment | §4.5 / §5.2 / §6 | P2 | ✅ done 2026-07-25 | 覆盖支付成功、重复支付、他人订单支付、支付查询权限 |
| T170.2 | 订单状态机服务测试 | server | §5.2 / §6 | P2 | ✅ done 2026-07-25 | 覆盖外卖完成路径、自取待取餐路径、禁止 preparing 直达 completed |


### P2 — client 测试输出降噪（T169）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T169.1 | 测试环境日志收口 | client | §3.6 / §6 | P2 | ✅ done 2026-07-25 | 静音 env/cart/auth 正常路径日志；跳过测试环境 401 延迟 logout；全量 Jest 干净退出 |


### P2 — client Sass 模块语法迁移（T168）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T168.1 | client SCSS @import 迁移 | client | §3.7 / §6 | P2 | ✅ done 2026-07-25 | 将 Dart Sass 弃用的 @import 替换为 @use；小程序构建无 Sass 弃用警告 |


### P2 — server 测试基线补齐（T167）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T167.1 | server 测试命令接入 | server | §6 | P2 | ✅ done 2026-07-25 | 将占位 test script 替换为真实 Node test + ts-node 执行 |
| T167.2 | 配送轨迹服务测试 | server | §3.17 / §6 | P2 | ✅ done 2026-07-25 | 覆盖外卖/配送中/骑手归属/轨迹写入与推送；4 tests passed |


### P2 — admin 裸 TypeScript 门禁修复（T166）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T166.1 | Umi runtime 类型补齐 | admin | §6 | P2 | ✅ done 2026-07-25 | 补 @umijs/max runtime shim，裸 tsc 可识别 history/useModel/layout |
| T166.2 | admin tsconfig monorepo 适配 | admin | §6 | P2 | ✅ done 2026-07-25 | rootDir 覆盖 workspace shared；关闭 side-effect CSS 严格误报 |
| T166.3 | admin 显式类型收口 | admin | §6 | P2 | ✅ done 2026-07-25 | Login initialState 回调与 Category actionRef 类型补齐 |


### P2 — 构建与测试基线修复（T165）— ✅ 2026-07-25

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T165.1 | client shared/asset/Jest/TS 配置修复 | client | §6 | P2 | ✅ done 2026-07-25 | 修复 @taste-food/shared alias、Jest 资源 mock、SCSS/图片声明、DEFAULT_PAGE_SIZE |
| T165.2 | client 小程序构建修复 | client | §6 | P2 | ✅ done 2026-07-25 | shared 源码纳入 Taro compile；CSS 提取忽略顺序；补 design token 导入 |
| T165.3 | admin 测试基线修复 | admin | §6 | P2 | ✅ done 2026-07-25 | Jest 映射 shared；admin shortOrderId 保持历史无 # 展示 |


### P2 — 配送轨迹地图（T164）— ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T164.1 | 配送轨迹表与 API | server/database | §3.17 / §4.12 / §5.1 | P2 | ✅ done 2026-07-24 | tf_delivery_tracks；GET/POST /orders/:id/delivery-track；权限复用订单归属 |
| T164.2 | 顾客订单详情地图 | client | §3.17 | P2 | ✅ done 2026-07-24 | 外卖订单展示 Taro Map、路线、骑手当前位置与最后更新时间 |
| T164.3 | 骑手位置上报 | client | §3.17 | P2 | ✅ done 2026-07-24 | 配送中订单可上报定位；定位失败使用演示坐标兜底 |


### P2 — 操作审计日志（T163）— ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T163.1 | 审计表与写入服务 | server | §3.16 | P2 | ✅ done 2026-07-24 | tf_audit_logs + AuditService 内存回退 |
| T163.2 | 全局写操作拦截器 | server | §3.16 | P2 | ✅ done 2026-07-24 | Admin POST/PATCH/PUT/DELETE 成功后记录 |
| T163.3 | 审计列表 API + admin 页 | server/admin | §3.16 | P2 | ✅ done 2026-07-24 | GET /audit-logs；/audit 列表筛选 |


### P2 — 运营工具（导出/评价回复 T161-T162）— ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T161.1 | 订单 CSV 导出 API | server | §3.15 | P2 | ✅ done 2026-07-24 | GET /orders/export，最多 1000 条，含发票/备注/商品摘要 |
| T161.2 | admin 导出按钮 | admin | §3.15 | P2 | ✅ done 2026-07-24 | 订单页导出当前筛选状态 CSV |
| T162.1 | 评价商家回复字段与 API | server | §3.15 | P2 | ✅ done 2026-07-24 | reply_content/reply_at；PATCH /reviews/:id/reply |
| T162.2 | 顾客端展示商家回复 | client | §3.15 | P2 | ✅ done 2026-07-24 | 订单详情只读评价展示回复 |
| T162.3 | 商家端回复入口 | client | §3.15 | P2 | ✅ done 2026-07-24 | admin/reviews 回复弹窗 |


### P2 — 桌号扫码入座（T160）— ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T160.1 | 桌台表与 CRUD API | server | §3.14 / §4.2 | P2 | ✅ done 2026-07-24 | tf_shop_tables；list/create/update/delete/seed；scanPath |
| T160.2 | 扫码上下文与菜单横幅 | client | §3.14 | P2 | ✅ done 2026-07-24 | dine-context 解析 tableNo/scene；菜单横幅；确认页默认堂食 |
| T160.3 | admin 桌台与二维码 | admin | §3.14 | P2 | ✅ done 2026-07-24 | /shop/tables 管理 + 打印辅助二维码 |


### P2 — 体验收尾打磨（T159）— ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T159.1 | 收藏页一键加购 | client | §3.12 / §3.13 | P2 | ✅ done 2026-07-24 | 收藏卡片加购 + 去点餐 CTA；下架禁用 |
| T159.2 | 菜单地址簿入口 | client | §3.12 / §3.13 | P2 | ✅ done 2026-07-24 | 菜单 header「地址」入口，登录校验 |
| T159.3 | 新订单提示音资源 | client | §3.12 | P2 | ✅ done 2026-07-24 | assets/sounds/new-order.wav + socket 播放 |
| T159.4 | server 构建 dist 可靠性 | server | §6 | P2 | ✅ done 2026-07-24 | tsconfig.build incremental=false，避免 dist 被删后不 emit |
| T159.5 | 再来一单回填备注/规格 | client | §3.12 | P2 | ✅ done 2026-07-24 | reorder 回填 shopId/remark/specOptionIds |


### P1 — 验收修复批次 — ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T158.1 | Public 路由可选 JWT，收藏回显 | server | §3.5 | P1 | ✅ done 2026-07-24 | Public 接口可选解析 JWT，登录用户菜单 isFavorite 可回显 |
| T158.2 | 骑手 shopId/WS 房间 | server | §3.3 | P1 | ✅ done 2026-07-24 | rider mock 绑 shopId；join role:rider；外送事件双发 |
| T158.3 | 抢单仅 PREPARING | server | §5.2 | P1 | ✅ done 2026-07-24 | 抢单池/grabOrder 仅 PREPARING 无骑手 |
| T158.4 | 配送语义：自配送 vs 骑手池 | client/admin | §3.2 | P1 | ✅ done 2026-07-24 | 文案改为「开始配送（商家）」；delivering 不在抢单池 |
| T158.5 | 关店禁下单 | server/client | §4.4 | P1 | ✅ done 2026-07-24 | 服务端 status/isOpenNow 拦截；菜单/确认页前端拦截 |
| T158.6 | StatusTimeline ready_for_pickup | client | §5.2 | P1 | ✅ done 2026-07-24 | 按 deliveryType 区分外送/自取堂食进度 |
| T158.7 | 订单 emit 状态时序 | server | §5.2 | P1 | ✅ done 2026-07-24 | cancelOrder 先改 status 再 emit |
| T158.8 | 真机 env 注释/警告 | client | §6 | P1 | ✅ done 2026-07-24 | env 真机局域网 IP 说明 + dev console.warn |


### P0 — 主路径阻断修复（验收回归）— ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T157.1 | 空 contactPhone 校验修复 | server/client | §4.4 | P0 | ✅ done 2026-07-24 | DTO ValidateIf 跳过空串；确认页空手机号不传字段 |
| T157.2 | 规格加价服务端核价 | server/client | §4.4 | P0 | ✅ done 2026-07-24 | items.specOptionIds + 服务端累加 priceAdjust；下单透传 |
| T157.3 | 堂食状态对齐 ready_for_pickup | client/admin | §5.2 | P0 | ✅ done 2026-07-24 | preparing 后自取/堂食均进 ready_for_pickup；禁止 preparing→completed |
| T157.4 | 商家看板统计路径修复 | client | §4.4 | P0 | ✅ done 2026-07-24 | /orders/stats/:shopId → /orders/stats/today |
| T157.5 | 订单 GET 禁用默认缓存 | client | §3.1 | P0 | ✅ done 2026-07-24 | request 对 /orders 默认不缓存，避免支付/接单后状态脏读 |


### P2 — 体验增强（下一迭代）⏳

> 对应 `prd.md` §3.12。支付/T43 不动。原子任务 15–60 分钟可完成。

#### T151 商家新订单提醒强化 — §3.12

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T151.1 | 新订单实时事件补强 | server | §3.12 | P2 | ✅ done 2026-07-24 | WS order:new/paid + payload 摘要字段；支付成功路径 notifyPaid/updateStatus 双保险 |
| T151.2 | 商家端提醒交互 | client | §3.12 | P2 | ✅ done 2026-07-24 | 振动 + 可选提示音；useDidShow 补拉 paid 待接单；商家页不在 tabBar 跳过角标 |
| T151.3 | 新订单提醒 UI | client | §3.12 | P2 | ✅ done 2026-07-24 | 品牌色横幅：金额/配送/桌号地址摘要；查看 + 一键接单 |

#### T152 营业时段管理 — §3.12

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T152.1 | 营业时段数据模型与 API | server | §3.12 / §5.1 | P2 | ✅ done 2026-07-24 | GET business-hours；PATCH business-hours；findById 返回 isOpenNow/nextOpenHint/businessHours；内存模式可用 |
| T152.2 | 商家/admin 营业时段配置 | client/admin | §3.12 | P2 | ✅ done 2026-07-24 | PC admin 按星期编辑时段（每天一段）；start<end 校验；PATCH business-hours |
| T152.3 | 顾客端非营业拦截 | client | §3.12 | P2 | ✅ done 2026-07-24 | 菜单页 isOpenNow=false 展示休息中+nextOpenHint；结算禁用兼容 status/isOpenNow |

#### T153 顾客地址簿 — §3.12 — ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T153.1 | 地址簿表与 CRUD API | server | §3.12 / §4.9 | P2 | ✅ done 2026-07-24 | tf_addresses + list/create/update/delete/default；用户隔离 |
| T153.2 | 地址簿列表与编辑页 | client | §3.12 | P2 | ✅ done 2026-07-24 | 列表/新增/编辑/删除/设默认；表单校验手机号 |
| T153.3 | 确认订单接入地址簿 | client | §3.12 | P2 | ✅ done 2026-07-24 | 外卖单默认带出地址；可切换；无地址引导新增 |

#### T154 订单评价 — §3.12 — ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T154.1 | 评价表与提交/查询 API | server | §3.12 / §4.10 | P2 | ✅ done 2026-07-24 | tf_reviews + POST/GET /orders/:id/reviews + GET /reviews |
| T154.2 | 订单详情评价入口 | client | §3.12 | P2 | ✅ done 2026-07-24 | completed 评分+文字提交；已评只读 |
| T154.3 | 商家端评价列表 | client | §3.12 | P2 | ✅ done 2026-07-24 | admin/reviews 列表（评分/内容/订单号） |

#### T155 通用弱网/错误重试/空态引导 — §3.12 — ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T155.1 | 请求层弱网检测与统一重试 | client | §3.12 | P2 | ✅ done 2026-07-24 | 复用 request 弱网 toast/自动重试；增强 isRetryableError 注释 |
| T155.2 | 页面错误态接入重试 | client | §3.12 | P2 | ✅ done 2026-07-24 | 菜单/订单列表/详情/骑手/收藏 失败展示重试 |
| T155.3 | 空态引导文案与 CTA | client | §3.12 | P2 | ✅ done 2026-07-24 | 购物车空/订单空/收藏空 引导去点餐 |

#### T156 下单备注与发票信息 — §3.12 — ✅ 2026-07-24

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T156.1 | 订单备注/发票字段扩展 | server | §3.12 / §5.1 | P2 | ✅ done 2026-07-24 | orders 增 remark/invoice_*；DTO 校验；创建订单持久化 |
| T156.2 | 确认订单备注与发票表单 | client | §3.12 | P2 | ✅ done 2026-07-24 | 备注输入；是否开票开关；抬头/税号条件展示 |
| T156.3 | 商家与 admin 展示备注发票 | client/admin | §3.12 | P2 | ✅ done 2026-07-24 | 订单详情展示备注与发票信息，便于出餐/开票 |

### P0 — 严重缺陷（安全/资金/构建，需优先修复）— ✅ 已全部完成

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T90 | 后端业务内存回退模式治理 | server | §5.1 | P1 | ✅ done 2026-07-12 | 创建 common/utils/memory-guard.ts（生产环境抛 503）；shop.service 局部变量改模块级 Map 实现 CRUD 持久化；favorites.service 修复假数据（缓存菜品信息）；menu.service DEFAULT_SHOP_ID 从 'shop001' 统一为 UUID；order/promotion/payment 共 21 处内存回退分支添加 assertMemoryFallbackAllowed 守卫；tsc 编译通过 |
| T91 | 后端认证安全加固 | server | §4.1 | P0 | ✅ done | JWT Secret 生产强制校验长度≥32；生产环境调用真实 code2Session；移除已存在用户角色覆盖逻辑防止提权；补充 .env.example 安全说明 |
| T92 | 订单金额服务端校验 | server | §4.4 | P0 | ✅ done | DTO 移除客户端 price/deliveryFee 控制；order.service 从 MenuService 查真实售价、从 ShopService 获取配送费并校验起送价 |
| T93 | 模拟支付安全标注与校验 | server | §4.5 | P0 | ✅ done | 生产环境禁用模拟支付接口；响应标注 mock:true；移除 payment.service 重复统计更新（一并修复 T101）；menu-item price 加 @IsInt @Min(0) |
| T94 | WebSocket 网关鉴权 | server | §6 | P0 | ✅ done | handleConnection 校验 JWT token；身份从 token 读取不信任客户端；未认证断开连接；房间加入基于 token 中的 role/userId |
| T95 | Supabase 客户端初始化竞态修复 | server | §5 | P0 | ✅ done | 改为 Promise 缓存初始化避免竞态；新增 getSupabaseClientAsync 供启动等待；main.ts 启动时 await 就绪；增加定期健康检查与自动重连 |
| T96 | admin 权限控制与登录安全修复 | admin | §3.4 | P0 | ✅ done | getInitialState 根据 currentUser.role 返回 canAdmin；routes.ts 所有路由添加 access:'canAdmin'；getCurrentUser 增加类型与容错；Login 移除 console.log 与无意义延迟 |
| T97 | admin 请求系统统一与缓存修复 | admin | §3.4 | P0 | ✅ done | 移除 GET 默认缓存改为显式 useCache:true；移除 app.tsx 中 UMI request 死代码；统一由 utils/request.ts 处理；401 清除 user 并跳转 |
| T98 | Docker 构建与镜像安全修复 | 部署 | §3.8 | P0 | ✅ done | server/Dockerfile 改多阶段构建解决 nest build 失败；添加非 root 用户和 HEALTHCHECK；创建 server/.dockerignore 和 admin/.dockerignore |
| T99 | docker-compose 与 CI 流程修复 | 部署 | §3.10 | P0 | ✅ done | 移除不存在的 db 依赖；添加 restart:unless-stopped 与完整环境变量；CI 升级 actions@v4 + npm 缓存 + client 测试 + tsc 检查；server 添加 test script |

### P1 — 中等缺陷（数据一致性/业务逻辑/体验）

#### 后端业务逻辑

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T100 | 订单状态机与规范对齐 | server | §5.2 | P1 | ✅ done | validateStatusTransition 对齐 AGENTS.md：外送/自取/堂食三种流转路径；移除 ACCEPTED→DELIVERING 跳过；grabOrder 仅允许 ACCEPTED/PREPARING 状态抢单（DELIVERING 已有骑手） |
| T101 | 订单统计重复累加修复 | server | §4.4 | P1 | ✅ done | 已在 T93 中一并修复：移除 payment.service 的重复 atomic_update_daily_stats 调用，统计更新仅由 orderService.updateStatus 内部处理 |
| T102 | 促销计算与查询逻辑修复 | server | §4.6 | P1 | ✅ done | promotion.service.ts 修复 OR 条件：`end_date.is.null,end_date.gt.now` 正确过滤过期记录；order.service 优惠计算失败 warn 日志 |
| T103 | 已支付订单取消退款流程 | server | §4.4 | P1 | ✅ done | cancelOrder 在 PAID 状态取消时更新 tf_payments 状态为 refunded + updated_at；状态机校验保证仅 PAID 可取消 |
| T104 | 多租户 shop_id 权限校验 | server | §5.1 | P1 | ✅ done | tf_users 加 shop_id 字段；auth.service UserRecord/toPayload/查询方法填充 shopId；menu/promotion create 用 user.shopId 覆盖 dto.shopId；shop update/delete 校验 id===user.shopId；order assertCanAccessOrder 加 shopId 校验，admin 查询用 user.shopId |
| T105 | 收藏 toggle 原子化 | server | §3.5 | P1 | ✅ done | addFavorite 改用 upsert + onConflict + ignoreDuplicates 原子化（基于已有 UNIQUE 约束）；新增 ToggleFavoriteDto 加 class-validator 校验 |
| T106 | 事务与通知服务修复 | server | §4 | P1 | ✅ done | deleteCategory 改用 atomic_delete_category RPC 事务化；notification.service 新增 resolveOpenId 从 tf_users 查 openid 不再误用 userId；reorder 联系人信息已传递 |
| T107 | Refresh Token 持久化 | server | §4.1 | P1 | ✅ done 2026-07-12 | database-init.sql 新增 tf_refresh_tokens 表（token_hash+user_id+expires_at+revoked）；auth.service.ts 用 SHA-256 哈希存储替代内存 Map，支持多实例部署与重启不失效；保留内存回退仅用于开发环境 Supabase 不可用时 |
| T108 | CORS 配置收紧 | server | §6 | P1 | ✅ done | main.ts CORS 改为环境感知：生产环境用 CORS_ORIGINS 白名单（逗号分隔），未配置则拒绝所有跨域；开发环境允许所有来源 |

#### 小程序 client

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T109 | 菜单规格弹窗加价计算与多选支持 | client | §3.1 | P1 | ✅ done | handleItemClick 开头重置 specExtraPrice；selectSpec 支持 maxSelect>1 多选（toggle + 上限校验）；加价基于 selectedOptions 重新计算 |
| T110 | 订单详情已支付按钮修复 | client | §3.1 | P1 | ✅ done | 支付按钮仅 PENDING_PAYMENT 显示；取消按钮保留 PAID 状态（已支付可取消退款） |
| T111 | 角色切换重复与飞入动画修复 | client | §3.1 | P1 | ✅ done | 移除 menu 页面手写角色切换悬浮球（已有全局 RoleSwitcher）；飞入动画选择器修正为 .spec-popup__add-cart-btn |
| T112 | 类组件 Store 订阅重构 | client | §3.1 | P1 | ✅ done 2026-07-12 | 8 个类组件页面重构为函数组件：order-confirm/order-detail/order-list/rider/auth-login/admin/menu-manage/user-manage；this.store.getState() 改为 useXxxStore((s)=>s.xxx) 选择器订阅；componentDidMount→useEffect、onShow→Taro.useDidShow；socket 回调用 useRef 持有最新函数避免闭包过期；tsc 编译无新错误 |
| T113 | WebSocket 回调时序与重连优化 | client | §3.1 | P1 | ✅ done | onOrderUpdated/onOrderCreated 先注册回调到 Map 再绑定（socket 为 null 不丢失）；新增 bindOrderHandlers 在 connect/reconnect 时绑定；reconnectionAttempts 改为 Infinity + reconnectionDelayMax 退避 |
| T114 | 搜索竞态与下拉刷新修复 | client | §3.1 | P1 | ✅ done | searchItems 加请求序号防竞态（慢响应丢弃）；order-list config 加 enablePullDownRefresh；onPullDownRefresh 改用 .finally 确保 stopPullDownRefresh 执行 |
| T115 | 配送费与店铺信息统一 | client | §3.1 | P1 | ✅ done | Shop 类型加 deliveryFee/minOrderAmount；menu 购物车栏配送费用 shop.deliveryFee；order-confirm 加载 shop 信息替代硬编码配送费和店铺名；order-list 加载店铺名；order-detail 默认值改 0 |
| T116 | Token 刷新策略优化 | client | §3.1 | P1 | ✅ done | refreshSession 区分网络错误（code -1 保留登录等待重试）与 refreshToken 过期（logout），避免网络波动误登出 |

#### PC 管理后台 admin

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T117 | admin 金额规范与 shopId 统一 | admin | §3.4 | P1 | ✅ done 2026-07-11 | 新建 utils/constants.ts 统一 DEFAULT_SHOP_ID 为 UUID；7 个页面移除 'shop001' 硬编码；Dashboard/Order/Menu Item 用 PriceDisplay 组件；ShopManage 配送费用 formatPrice 函数 |
| T118 | admin 表单校验与 Modal loading | admin | §3.4 | P1 | ✅ done 2026-07-11 | 5 个表单页面（Category/Item/Promotion/ShopManage/Shop）增加 submitting/editSaving 状态、Modal confirmLoading、表单 rules message；区分表单校验失败与服务器错误 |
| T119 | admin 列表分页与订单详情 | admin | §3.4 | P1 | ✅ done 2026-07-11 | Order 详情改为调用 getOrder(id) 获取完整数据，detailLoading + Spin 包裹；商品列表判空；增加 contactName/contactPhone 展示；列表分页由后端服务（已实现） |
| T120 | admin Dashboard 图表数据源修复 | admin | §3.4 | P1 | ✅ done 2026-07-11 | 后端新增 getDailyStats + getStatusDistribution 方法与 /stats/:shopId/daily + /stats/:shopId/status-distribution 接口（多租户隔离）；前端 Dashboard 改用服务端聚合接口，避免用 10 单推算全店趋势；补 ready_for_pickup 文案 |
| T121 | admin Token 刷新与状态枚举对齐 | admin | §3.4 | P1 | ✅ done 2026-07-11 | Login 存储 refreshToken；request 拦截器 401 时并发控制 refresh + 重试一次（refresh/login 接口本身不重试）；app.tsx 退出清除 refreshToken；Order tab 增加 ready_for_pickup；35 测试通过 |
| T122 | admin Shop/ShopManage 合并与 service 统一 | admin | §3.4 | P1 | ✅ done 2026-07-11 | ShopManage 重构为使用 @/services/shop 服务函数，复用 Shop 接口类型，移除内联 request 调用与本地 Shop 接口定义 |

#### 通用层

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T123 | 数据库索引与 CHECK 约束补充 | database | §5.1 | P1 | ✅ done 2026-07-12 | 补充索引：tf_order_items.order_id/shop_id/menu_item_id、tf_payments.order_id/shop_id/status/user_id、tf_promotions.shop_id/status、tf_delivery_info.order_id 等；补充 CHECK 约束：tf_shops/tf_menu_items/tf_orders(9态)/tf_orders.delivery_type/tf_promotions/tf_users/tf_payments |
| T124 | 数据库外键 ON DELETE 与时间戳补充 | database | §5.1 | P1 | ✅ done 2026-07-12 | 外键 ON DELETE：CASCADE/RESTRICT/SET NULL 分级；补充 updated_at：tf_order_items/tf_delivery_info/tf_payments/tf_item_sales；tf_delivery_info 补充 created_at |
| T125 | 数据库 shop_id 补充与命名规范 | database | §5.1 | P1 | ✅ done 2026-07-12 | tf_order_items/tf_delivery_info/tf_payments 补充 shop_id；tf_users.userId 重命名为 user_id；atomic_create_order p_user_id 从 uuid 改为 text 匹配 user_id 列；RPC 内 INSERT 补充 shop_id |
| T126 | api.yaml 与 prd.md 文档同步 | docs | §4 | P1 | ✅ done 2026-07-12 | api.yaml 从 7 路径扩展到 31 路径覆盖全部 ~46 端点，含 components/schemas 可复用类型；prd.md 5.1 补充 tf_favorites/tf_daily_stats/tf_item_sales 三张表及 shop_id 字段；状态流转图补充 ready_for_pickup |

### P2 — 轻微问题与优化建议

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T127 | 后端 DTO 校验完善与日志统一 | server | §4 | P2 | ✅ done 2026-07-12 | OrderQueryDto.status 改 @IsEnum(OrderStatus)；CreateOrderDto.contactPhone 加 @Matches(/^1[3-9]\d{9}$/)；CreateOrderItemDto.price 加 @Min(0)；CreateMenuItemDto.status 改 @IsEnum(MenuItemStatus)；favorites/order/menu service 的 console.warn/error 改为 NestJS Logger（payment/promotion 已是干净状态）；deliveryFee 字段不存在于 DTO（服务端从店铺配置获取） |
| T128 | 后端 N+1 查询与性能优化 | server | §4 | P2 | ✅ done 2026-07-12 | FavoritesService 新增 batchCheckFavorites 批量查询；toMenuItemResponse 增加 favoriteSet 参数做内存判断；getMenuItems/getPopularItems 批量查询收藏消除 N+1；getTodayStats 优先读 tf_daily_stats 预聚合 totalOrders/completedCount + 轻量查询 status/total 计算 revenue/pending/preparing，保留内存回退分支；forwardRef 循环依赖改事件解耦 — 暂缓 |
| T129 | 后端代码清理 | server | §4 | P2 | ✅ done 2026-07-12 | contactNameValid 字段不存在（已是干净状态）；validation.pipe.ts 不存在（main.ts 已用内置 ValidationPipe）；storage.controller.ts 删除接口 :path 改为 *path 通配以处理含/路径；内存模式收藏返回假数据已在 T90 修复 |
| T130 | client 代码质量优化 | client | §3.1 | P2 | ✅ done 2026-07-12 | chooseImage→chooseMedia（回调改 tempFiles[0].tempFilePath）；rider shortOrderId 去重#；socket.ts localStorage→Taro.setStorageSync + any→unknown；menu-manage URL 改用 API_BASE_URL；BottomSheet/StatusTimeline/SkeletonLoader 组件暂保留待后续使用，不删除 |
| T131 | admin 代码质量与测试覆盖 | admin | §3.4 | P2 | ✅ done 2026-07-12 | Order/Menu/Category/Promotion/ShopManage 页面 any→具体类型；删除未使用导入(OrderStats/getOrderStats/UserOutlined)；onPageNotFound 返回值改 void；5 个测试 mock 统一为 __esModule+default 写法；promotion.ts rule any→Record<string,unknown>；Login 经核查无 console.log/setTimeout 残留（已是干净状态） |
| T132 | Nginx 配置增强 | 部署 | §3.8 | P2 | ✅ done 2026-07-12 | admin/nginx.conf 和 nginx/conf.d/default.conf 添加 gzip 压缩、安全头(X-Frame-Options/X-Content-Type-Options/X-XSS-Protection)、limit_req 限流(zone=api:10m rate=10r/s)、client_max_body_size 10m、静态资源缓存头(expires 30d + immutable)、access_log；admin /api 代理添加 X-Forwarded-For；WebSocket /socket.io 添加 proxy_read/send_timeout 3600s |
| T133 | 依赖版本与测试配置修复 | 部署 | §3.10 | P2 | ✅ done 2026-07-12 | admin @types/react 从 19.2.17 降到 18.3.31、@types/react-dom 从 19.2.3 降到 18.3.7；添加 react ^18.2.0 和 react-dom ^18.2.0 到 dependencies；client socket.io-client 从 ^4.8.3 对齐到 ^4.7.0(与 server 一致)；Playwright headless/channel 改为根据 CI 环境变量决定 |
| T134 | 清理垃圾文件与脚本修复 | 部署 | §3.7 | P2 | ✅ done 2026-07-12 | 删除 utils.test.ts.backup(--detectOpenHandles/--verbose 不存在跳过)；nightly-automation.sh 移除 docs/bug.md 引用，grep 改为匹配 tasks.md 的 ⏳ todo；run-nightly.sh 从无限 sleep 改为调用 nightly-automation.sh；start-devtools.sh 添加 set -e 和 CLI/项目目录存在性检查；prod.ts localhost 改为 PROD_API_HOST 环境变量 + HTTPS/WSS |

---

## UI 界面优化批次（T135-T149）

> **来源**: 2026-07-12 前端界面设计/交互/组件/样式深度调研（3 个子代理并行分析 client 8 页面+8 组件、admin 9 页面+4 组件、全局样式规范）
> **范围**: client 小程序 + admin 后台 + 全局样式规范
> **原则**: 任务可独立执行，按 P0→P1→P2 顺序推进；组件封装优先于样式重构

### P0 — 安全/构建/品牌一致性

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T135 | client 安全区域适配补全 | client | §3.1 | P0 | ✅ done 2026-07-24 | cart-bar 增加 min-height + safe-area padding；order-actions 合并重复定义并补 safe-area；order-confirm footer-bar 已有 safe-area 保持 |
| T136 | 全局品牌色统一 | 全局 | §3.1 | P0 | ✅ done 2026-07-24 | client 全部 #e74c3c→#FF6B35（渐变对齐 #FF8F65，拒单态用 #FF5252）；admin config antd theme colorPrimary=#FF6B35；Dashboard/User/Shop #1890ff→品牌色；order-actions 重复定义已在 T135 合并 |
| T137 | admin 表格分页与搜索筛选补全 | admin | §3.4 | P0 | ✅ done 2026-07-24 | Category/Item/Promotion/ShopManage 补充分页；Order/User 开启 showSizeChanger；Item 名称+分类筛选、Category/Promotion 名称搜索、User 昵称+角色筛选；Order 状态 Tabs+拒单 Popconfirm、Promotion dayjs 已存在 |

### P1 — 体验/组件/样式

#### client 小程序

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T138 | client 已建未用组件接入页面 | client | §3.1 | P1 | ✅ done 2026-07-24 | SkeletonLoader 接入 menu/order-list/rider/order-detail；EmptyState 接入 order-list/rider/order-detail；BottomSheet 接入菜单规格弹窗；StatusTimeline 接入订单详情 |
| T139 | client 下拉刷新与分页修复 | client | §3.1 | P1 | ✅ done 2026-07-24 | rider usePullDownRefresh+stopPullDownRefresh；user-manage onScrollToLower 分页；order-detail 继续点餐已用 switchTab；menu 页 enablePullDownRefresh + usePullDownRefresh |
| T140 | client 表单校验与防重复提交 | client | §3.1 | P1 | ✅ done 2026-07-24 | order-confirm 手机号/桌号/联系人校验+满减优惠预估扣减展示；menu 加购 addingToCart 防重；rider 抢单/送达 actingId 防重；menu-manage 表单 formSubmitting 防重 |
| T141 | client 通用组件封装 | client | §3.1 | P1 | ✅ done 2026-07-24 | 新增 SectionCard/FooterBar/FilterTabs/OrderCard + hooks useAsyncAction/usePullRefresh + utils validators/promotion；order-confirm/order-list/rider/menu 已接入；components/index.ts 统一导出 |

#### admin 后台

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T142 | admin 公共组件推广与 useCrudModal 抽取 | admin | §3.4 | P1 | ✅ done 2026-07-24 | PageHeaderActions/TableCard 推广至 Order/User/Promotion/ShopManage；useCrudModal 落地并在 Category 使用；Shop 单店编辑留后续 |
| T143 | admin Dashboard 与图片上传增强 | admin | §3.4 | P1 | ✅ done 2026-07-24 | Dashboard 时间范围 Segmented+刷新+StatisticCard，移除柱状冗余图；菜品 ImageUpload 接 /api/storage/images/menu；Login 账号密码表单；多页加载失败 message.error；顺带修复 stats API 路径对齐后端 /stats/today|daily|status-distribution |
| T144 | admin 通用组件封装 | admin | §3.4 | P1 | ✅ done 2026-07-24 | SearchFilterBar/DeliveryTypeTag/EmptyState + DEFAULT_TABLE_PAGINATION；Item/Category/Promotion/User/Order 接入；CrudPageTemplate/StatisticCard 可后续增强 |

#### 全局样式

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T145 | 全局 design-tokens 落地 | 全局 | §3.1 | P1 | ✅ done 2026-07-24 | client app.scss/order-confirm/order-list + 新组件 scss 引入 design-tokens；admin theme.ts + global.css CSS 变量 + antdTheme 接入 config；TableCard/PageHeaderActions 使用 brand 令牌 |

### P2 — 轻微优化

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T146 | client 菜单联动与虚拟滚动 | client | §3.1 | P2 | ✅ done 2026-07-24 | 分类点击↔列表滚动双向联动（scroll-spy + scrollIntoView 重置）；订单列表接入轻量 VirtualList 窗口化渲染 |
| T147 | client 内联样式抽离与无障碍 | client | §3.1 | P2 | ✅ done 2026-07-24 | order-confirm 内联 style 抽离；MenuItemCard Image lazyLoad + aria-label；收藏/加购无障碍标签 |
| T148 | admin ProComponents 渐进式迁移 | admin | §3.4 | P2 | ✅ done 2026-07-24 | Category 全面迁移 ProTable+ModalForm+PageContainer；Order/User/Item/Promotion/ShopManage 接入 PageContainer 面包屑 |
| T149 | 全局通用 mixin 与工具类 | 全局 | §3.1 | P2 | ✅ done 2026-07-24 | client _mixins.scss + 工具类；admin global 工具类；表格列宽与 PageContainer 标题补全 |
| T150 | 沙箱支付渠道化与第三方预留 | payment | §4.5 | P2 | ✅ done 2026-07-24 | PAYMENT_PROVIDER=sandbox/wechat/third_party；沙箱默认开发可用，生产需 ALLOW_SANDBOX_PAYMENT；响应含 provider；wechat/third_party 明确未配置报错；.env.example 补充说明 |


## 将来/暂缓

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T43 | 真实微信支付集成 | payment | §3.5 | P2 | 📋 paused | 暂缓，需企业资质 |
| T181 | 将 docs/database-init.sql 应用到线上 Supabase | database | §5.1 | P1 | 📋 paused | 补齐 RPC/缺列/tf_delivery_tracks/tf_refresh_tokens 后可去掉兼容回退 |

## 统计

| 状态 | 数量 |
|------|------|
| ⏳ todo | 0 |
| 🔧 in_progress | 0 |
| ✅ done | 140 |
| 🚫 blocked | 0 |
| 📋 paused | 2 |
| **总计** | **141** |

> 说明：T151–T180 已完成；T43 仍为 paused。线上库 schema 落后于 database-init.sql，当前靠服务端兼容回退可演示上线。

### 按优先级分布

| 优先级 | 数量 | 说明 |
|--------|------|------|
| P0 | 17 | ✅ 17 完成 |
| P1 | 44 | ✅ 44 完成 |
| P2 | 80 | ✅ 79 完成 + 📋 1 暂缓（T43）；体验增强/质量基线 T151–T179 完成 |

### 按模块分布

| 模块 | 数量 | 任务范围 |
|------|------|----------|
| server | 51 | 含安全、订单、营业、地址、评价、审计、配送轨迹、下单核价与测试基线 |
| client | 44 | 含顾客/商家/骑手小程序体验、性能、测试基线、Sass 模块语法与测试降噪 |
| admin | 20 | 含后台页面、ProComponents、测试与 TypeScript 门禁 |
| client/admin | 4 | 小程序与后台共同完成项 |
| server/client | 3 | 后端与小程序共同完成项 |
| database | 3 | 基础数据一致性任务 |
| 部署 | 7 | Docker/CI/依赖、构建配置与统一质量门禁 |
| docs | 1 | T126 |
| 全局 | 3 | T136, T145, T149 |
| payment | 2 | T43 (paused), T150 |
| server/database | 1 | T164.1 |
| server/admin | 1 | T163.3 |
| server/payment | 1 | T170.1 |

### 体验增强批次执行建议

| 阶段 | 任务 | 目标 |
|------|------|------|
| 1. 降漏单 | T151.1 → T151.2 → T151.3 | 商家新订单可感知、可跳转 |
| 2. 可营业 | T152.1 → T152.2 → T152.3 | 营业时段配置 + 顾客端拦截 |
| 3. 下单效率 | T153.1 → T155.1 → T156.1 | 地址簿/弱网/备注发票并行打底 |
| 4. 闭环体验 | T154.x + 剩余前端接入 | 评价与页面态打磨 |

### UI 优化批次执行建议

| 阶段 | 任务 | 目标 |
|------|------|------|
| 1. 基础修复 | T135, T136, T137 | ✅ 已完成：安全区域+品牌色+admin 分页搜索 |
| 2. 组件基建 | T141, T144, T145 | ✅ 公共组件/hooks/tokens 已落地 |
| 3. client 体验 | T138, T139, T140 | ✅ 全部完成 |
| 4. admin 体验 | T142, T143 | ✅ 全部完成 |
| 5. 性能优化 | T146, T147, T148, T149, T150 | ✅ 虚拟滚动+无障碍+ProComponents+mixin+沙箱支付 |

---

*最后更新: 2026-07-25（T180 旧库 schema 兼容与全链路冒烟验收完成；个人主体可演示上线，T43 仍暂缓）*
