# 任务看板

> **唯一状态源** — 仅维护当前待办、进行中、阻塞与将来/暂缓事项  
> **状态**: `todo` → `in_progress` → `done` | `blocked`  
> **关联**: 每条任务链接到 `prd.md` 对应章节  
> **需求文档**: `docs/prd.md`

---

## 2026-08-01 ~ 2026-08-02 已完成（自 tasks.md 迁移）

### T266.5 — 豆包预生成固定话术 MP3（离线可靠，替代实时 Edge TTS）— ✅ done 2026-08-01

> **PRD**: §3.19 / 消息通知（新订单提醒 UX 增强）  
> **来源**: 用户确认用豆包（火山引擎）一次性生成固定话术音频保存，离线播放，避免 Edge TTS 从中国连微软 WebSocket 不稳定的问题。  
> **方案**: 新建 `admin/src/utils/alertPhrases.ts`（话术池 + 清洗 + `phraseToFile` 稳定哈希，播放端与生成脚本共用）、`scripts/gen-alert-voice.mjs`（豆包 seed-tts-2.0 一次性生成 9 条话术到 `admin/public/sounds/alert/`）；`orderAlertSound.ts` 改为「预生成 MP3 优先 → speechSynthesis → new-order.wav 兜底」。生成需火山引擎语音合成 API Key（`node scripts/gen-alert-voice.mjs --key <KEY>` 或 `VOLC_API_KEY` 环境变量）。  
> **坑**: ① 音频 Key 与 ARK(`ark-`前缀) Key 不互通，须用语音合成控制台的 Key；② 接口返回「换行分隔多段 JSON 流」，首段 `data` 为 base64 音频，须按行解析拼接。  
> **结果**: 9 个 MP3（佩奇猪 2.0）已落地 `admin/public/sounds/alert/`，全部 ID3 合法，14.7–32.3 KB；播放链已接入，构建后随包部署离线可用。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T266.5.1 | alertPhrases.ts 单一数据源（话术+清洗+哈希） | admin | §3.19 | P1 | ✅ done 2026-08-01 | 与生成脚本命名一致 |
| T266.5.2 | gen-alert-voice.mjs 豆包生成脚本 | scripts | §3.19 | P1 | ✅ done 2026-08-01 | seed-tts-2.0；--key/--voice/--out；按行解析多段 JSON 流 |
| T266.5.3 | orderAlertSound 改预生成 MP3 优先播放链 | admin | §3.19 | P1 | ✅ done 2026-08-01 | tsc 0 错误 |
| T266.5.4 | 运行脚本产出 9 个 MP3 | data | §3.19 | P1 | ✅ done 2026-08-01 | 佩奇猪 2.0；全部 ID3 合法 |

### T266.6 — 商家语音播报场景扩展（催单 / 骑手接单 / 新评价）— ✅ done 2026-08-01

> **PRD**: §3.19 / 消息通知（新订单提醒 UX 增强）  
> **来源**: 用户要求除现有的「新订单已支付」「取消(退款)申请」外，从商家视角增加更多语音触发场景：顾客催单、骑手接单取餐、新评价。  
> **映射**: 退款/售后申请复用既有 `order_cancel_request`（本就是商家售后通知，已播报）；新增 `order_reminder`（催单，真实事件 `urgeOrder`）、`rider_assigned`（骑手抢单 `grabOrder`）、`new_review`（评价 `review.createForOrder`）。`inbox.type` 为自由字符串，扩展无需改表。  
> **方案**: `alertPhrases.ts` 新增三类话术（温柔桃子，温润规范）；`gen-alert-voice.mjs` 同步后重生成全部 19 条 MP3；`orderAlertSound.ts` 的 `shouldPlayOrderAlert` 与 `playAdminOrderAlert` 扩展至 5 类商家通知；后端将 `OrderService.notifyShopStaff` 改为 public，在 `urgeOrder`/`grabOrder`/`review.createForOrder` 成功后发对应通知（经 `inboxService.create` → WebSocket `notification:new` → 前端播报，链路已验证）。  
> **结果**: 19 个 MP3（温柔桃子 2.0）落地 `admin/public/sounds/alert/`；商家后台在催单/骑手接单/新评价时均会语音播报。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T266.6.1 | alertPhrases.ts 新增 order_reminder/rider_assigned/new_review 话术 | admin | §3.19 | P1 | ✅ done 2026-08-01 | 温柔桃子；温润规范不俏皮 |
| T266.6.2 | gen-alert-voice.mjs 同步 + 重生成 19 条 MP3 | scripts | §3.19 | P1 | ✅ done 2026-08-01 | 同一音色；全部 ID3 合法 |
| T266.6.3 | orderAlertSound.ts 触发判断与类型映射扩展 | admin | §3.19 | P1 | ✅ done 2026-08-01 | 5 类商家通知 |
| T266.6.4 | 后端 urgeOrder 发 order_reminder 通知 | server/order | §3.19 | P1 | ✅ done 2026-08-01 | 催单冷却已存在，仅补商家通知 |
| T266.6.5 | 后端 grabOrder 发 rider_assigned 通知 | server/order | §3.19 | P1 | ✅ done 2026-08-01 | 骑手抢单原子操作内已置 rider_id+delivering |
| T266.6.6 | 后端 review.createForOrder 发 new_review（notifyShopStaff 改 public 复用） | server/review | §3.19 | P1 | ✅ done 2026-08-01 | Supabase 与内存回退双路径均接 |

### T266.7 — 商家可配置语音播报（每重要状态 3 选 1）— ✅ done 2026-08-02

> **来源**: 用户要求「针对商家，重要状态下挑选一个作为当前状态语音通知，每个重要状态系统提供 3 个」。
> **方案**: `alertPhrases.ts` 重构为 `VOICE_OPTIONS`（每重要状态固定 3 条，带稳定 id+text）；新增 `voiceConfig.ts`（按 shopId 隔离的 localStorage 选择存储 + `resolvePhrase`）；`orderAlertSound.ts` 改用商家所选话术（确定性，弃随机）并导出 `previewVoicePhrase` 供试听；新增 `VoiceAlertSettings` 页面（每状态 3 选项 + 试听 + 单选 + 保存，路由 `/voice-alert` access `canMerchant`）；`gen-alert-voice.mjs` 同步池并重生成 16 条 MP3（每状态 3 + default），清理 3 个孤立旧文件。

| ID | 任务 | 模块 | 优先级 | 状态 | 备注 |
|----|------|------|--------|------|------|
| T266.7.1 | alertPhrases 重构为 VOICE_OPTIONS（3 选 1 结构化）+ 派生 PHRASE_POOL | admin | P1 | ✅ done 2026-08-02 | 保留 id 解耦文本；附 LABELS/ORDER |
| T266.7.2 | 新增 voiceConfig.ts：按 shopId 存选择 + resolvePhrase | admin | P1 | ✅ done 2026-08-02 | localStorage；default 取首条 |
| T266.7.3 | orderAlertSound 改用所选话术 + 导出 previewVoicePhrase | admin | P1 | ✅ done 2026-08-02 | 弃随机；tsc 0 错 |
| T266.7.4 | 新增 VoiceAlertSettings 页面 + /voice-alert 路由（canMerchant） | admin | P1 | ✅ done 2026-08-02 | 试听/单选/保存/恢复默认 |
| T266.7.5 | 生成脚本同步池 + 重生成 16 条 + 清理 3 孤立 | scripts | P1 | ✅ done 2026-08-02 | 温柔桃子；16 文件精确对应 |

### T267 — 批量异步导出（导出中心）— ✅ done 2026-08-01

> **PRD**: §3.21 / §4.4（`/api/export-jobs`）/ §5.1（`tf_export_jobs`）
> **来源**: 用户要求解决批量异步导出任务，并明确「PC 导出走 Excel 不走 CSV」。
> **方案**: 新建 `tf_export_jobs` 表（migration v28 + database-init.sql 1.0.7）；`server/src/modules/export/`（ExportService 任务 CRUD + 内存回退 / ExportRunnerService 后台生成 xlsx + 站内信通知 / ExportController 提交·列表·详情·下载·店铺隔离）；`StorageService` 增加通用 `uploadBuffer`/`downloadBuffer`（私有桶 export-files）；`shared` 与 `server` 双写 `ExportJobStatus` 枚举；admin 新增「导出中心」页面（任务列表/新建/下载 + WebSocket 通知 + 轮询兜底）、`services/export.ts`、`useExportQueries`、路由；订单页「后台导出 Excel」改为提交异步任务。
> **结果**: 仅产出 Excel（.xlsx），不走 CSV；大批量后台异步生成不阻塞响应；完成后 WebSocket 推送通知并可在导出中心下载。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T267.1 | tf_export_jobs 表 + 迁移 v28 + database-init 1.0.7 | db | §5.1 / §3.21 | P2 | ✅ done 2026-08-01 | 状态机 pending→processing→completed/failed；私有桶 export-files |
| T267.2 | 导出枚举双写（shared + server） | shared/server | §3.21 | P2 | ✅ done 2026-08-01 | ExportJobStatus / ExportEntity / EXPORT_FORMAT_XLSX |
| T267.3 | StorageService 通用上传/下载 | storage | §3.21 | P2 | ✅ done 2026-08-01 | uploadBuffer/downloadBuffer + ensureBucket + 内存回退 |
| T267.4 | ExportService + ExportRunnerService | export | §3.21 | P2 | ✅ done 2026-08-01 | 后台异步生成 xlsx + 站内信通知；复用 orderService.exportOrdersCsv |
| T267.5 | ExportController + 注册 ExportModule | export | §4.4 / §3.21 | P2 | ✅ done 2026-08-01 | 提交/列表/详情/下载；下载校验店铺归属、非 completed 返回 409 |
| T267.6 | Admin 导出中心页面 + 路由 + 查询 | admin | §3.21 | P2 | ✅ done 2026-08-01 | 列表/新建/下载 + WS 通知 + 轮询兜底 |
| T267.7 | 订单页接入异步导出 | admin | §3.21 | P2 | ✅ done 2026-08-01 | 「后台导出 Excel」提交异步任务 |

### T300 — PC 管理后台双入口改造（平台端 / 商家端）— ✅ done 2026-08-02

> **PRD**: §3.18（增强）/ 新增 §3.22
> **来源**: 用户确认将「平台管理员」与「商家管理员（即商家）」拆成两个入口。沿用现有角色模型（`admin`+`shop_id` 空=平台，`merchant` 或 `admin`+`shop_id`=商家），不新增角色枚举。
> **方案**: 前端按角色渲染不同 layout/菜单/路由分组（`/platform/*`、`/merchant/*`）/落地页/顶栏；后端 API 分前缀 + 框架级 `ShopScope` 守卫统一隔离（deny-by-default）、修复提权缺口；数据层幂等归并二义账号。
> **前端**: 抽离唯一 `computeAccess(user)` 纯函数收敛 4 处权限计算并修 `canMerchant` 闪现 bug；`config/routes.ts` 新增 `/platform`、`/merchant` 父级分组挂 access；`app.tsx` 双 Layout 动态切换品牌/标题/顶栏（平台治理范围选择器 vs 商家本店锁定）；`homePathForRole` 按端分流；`shopContext` 语义分离 + 启用 `RoleSwitcher` 顶栏模式。
> **后端**: `audit-logs` 整体前缀化为 `/api/platform/audit-logs`；启用 `isPlatformAdmin/isShopOperator` 权威 helper，新增 `ShopScopeGuard`/`@PlatformOnly`/`@MerchantOnly`（deny-by-default）；修复 `role-applications`（列表/审批）、`audit-logs`（整体）、`users/:id`（详情）三处提权缺口。业务接口保持中性前缀 + 店铺隔离。
> **数据**: 迁移 v29 将 `role=admin` 且 `shop_id` 非空的二义账号统一归并为 `merchant`（幂等）；同步订正 `tf_users.shop_id` 注释与 `ensureDemoMerchant`。
> **结果**: 后端 `tsc -p tsconfig.build.json --noEmit` 0 错；`ShopScopeGuard`/`@PlatformOnly`/`@MerchantOnly` 隔离逻辑断言（四角色 × 三场景）全部 PASS；prd.md §3.18/§4.11 状态闭环为 done。完整 HTTP 双端联调需 Supabase 环境。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T300.1 | 前端权限计算收敛为 computeAccess | admin | §3.18 | P1 | ✅ done 2026-08-02 | 替换 4 处散落逻辑；修 canMerchant bug |
| T300.2 | 前端路由分组 /platform 与 /merchant | admin | §3.18 | P1 | ✅ done 2026-08-02 | 父级 access；菜单归属 |
| T300.3 | 前端双 Layout 与顶栏分流 | admin | §3.18 | P1 | ✅ done 2026-08-02 | 平台治理范围 vs 商家本店 |
| T300.4 | 前端落地页分流与 shopContext 语义分离 | admin | §3.18 | P1 | ✅ done 2026-08-02 | 启用 RoleSwitcher 顶栏模式 |
| T300.5 | 后端 API 分 platform/merchant 前缀 | server | §3.18 | P1 | ✅ done 2026-08-02 | 平台治理接口 /platform 前缀化（audit-logs 整体 /platform/audit-logs）；业务接口保持中性前缀 + 店铺隔离 |
| T300.6 | 后端 ShopScope 守卫与提权修复 | server | §3.18 | P1 | ✅ done 2026-08-02 | ShopScopeGuard + @PlatformOnly/@MerchantOnly（deny-by-default）；修复 role-applications/audit-logs/users/:id 三处提权缺口 |
| T300.7 | 数据订正 admin+shopId 二义账号 | db | §3.18 | P2 | ✅ done 2026-08-02 | 迁移 v29（admin+shopId → merchant，幂等）；订正 tf_users 注释与 ensureDemoMerchant |
| T300.8 | 双入口改造联调验证 | test | §3.18 | P1 | ✅ done 2026-08-02 | 后端 tsc 通过 + ShopScopeGuard/@PlatformOnly/@MerchantOnly 隔离逻辑断言全部通过；完整 HTTP 双端联调需 Supabase 环境 |

---

## 当前待办

### T266 — PC 新订单语音播报（Edge TTS 免费女声）— ✅ 2026-08-01

> **PRD**: §3.19 / 消息通知（新订单提醒 UX 增强）  
> **来源**: 用户希望新订单提醒从机械提示音改为俏皮女声语音播报；小程序端保持 WS 推送不播报。  
> **方案**: PC 后台优先走后端 Edge TTS 代理（/api/tts/edge，微软在线神经女声，免费无需 Key），降级链为 浏览器 speechSynthesis → new-order.wav。关键坑：微软端点要求 Sec-MS-GEC 时间窗口 DRM 令牌（SHA256(300s 窗口刻度 + 固定令牌)）且 Sec-MS-GEC-Version 须为当前 Edge 大版本（143）；二进制音频帧头长度为大端（BE）。  
> **结果**: 后端代理已验证返回合法 MP3（audio/mpeg，20160 字节）；生产 orderAlertSound 已接入并 tsc 通过；试听页 new-order-voice-demo.html 可试听各女声。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T266.1 | 后端 TTS 代理模块（tts.module/controller/service，Edge TTS WebSocket + Sec-MS-GEC DRM + BE 帧解析） | server | §3.19 | P2 | ✅ done 2026-08-01 | /api/tts/edge；@Public()；多版本回退；ts-node 验证产 20160B MP3 |
| T266.2 | 生产 orderAlertSound 接入 Edge TTS 优先 + speechSynthesis/wav 兜底 | admin | §3.19 | P2 | ✅ done 2026-08-01 | 默认女声 XiaoxiaoNeural；~ 符号清洗；tsc --noEmit 通过 |
| T266.3 | 试听 demo 页（new-order-voice-demo.html）试听各女声 + 本地对比 | docs | §3.19 | P3 | ✅ done 2026-08-01 | Edge 走后端代理；~ 过滤；豆包为可选付费进阶 |

### T265 — PC 消息中心标已读后铃铛未读数不同步 — ✅ 2026-08-01

> **PRD**: §3.19 / §消息通知  
> **来源**: 用户截图反馈，在消息中心标记单条消息为已读后，顶部铃铛角标未读数没有同步更新。  
> **根因**: `NotificationBell` 组件使用本地 `useState` 维护未读数 `count`；`Messages` 页面通过 `useMarkNotificationRead` mutation 成功后仅 invalidate React Query 缓存，无法触发自管 state 的铃铛重新渲染。  
> **修复**: `NotificationBell` 改用 `useUnreadCount` React Query hook 读取未读数；收到 WS 推送时直接 `setQueryData` 或 `refetchUnreadCount`；下拉菜单点击标已读改用 `useMarkNotificationRead` mutation；移除冗余的本地 5 分钟兜底轮询（`useUnreadCount` 已自带 60 秒轮询）。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T265.1 | NotificationBell 接入 useUnreadCount + useMarkNotificationRead | admin | §3.19 | P1 | ✅ done 2026-08-01 | 移除本地 count state；WS 推送直接写 query cache；tsc --noEmit 通过 |

### T264 — 订单号流水改「高水位」防删单撞号 — ✅ 2026-08-01

> **PRD**: §数据库设计 / tf_orders.order_no 生成规则  
> **来源**: 用户反馈删单后订单流水会跳号/漂移（如 TF20260729I010004，当天仅 1 单堂食）。  
> **根因**: `allocateOrderNo` 用「当日订单条数 +1」算流水，删单后 count 变小 → 生成的号与既有 order_no 撞唯一索引，或序号回退。  
> **修复**: 改为「当日该(店铺+配送类型)组已有 order_no 最大流水段 +1」的高水位策略；原子创建 RPC 外层加撞号重试。订单号格式不变，仍为 `TF+YYYYMMDD+类型码+店铺序号2位+流水4位`。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T264.1 | allocateOrderNo 改高水位(max+1) + parseOrderSeq 解析末4位 | server | tf_orders | P1 | ✅ done 2026-08-01 | Supabase/内存双路径；店铺序号段用 `\d{2}` 防漂移；tsc --noEmit 通过 |
| T264.2 | 原子创建撞号重试(isDuplicateOrderNoError, 最多3次重分配) | server | tf_orders | P1 | ✅ done 2026-08-01 | 同步 order.orderNo 供 persistOrderNo/WS |
| T264.3 | 默认店铺历史 order_no 规范化 | data | tf_orders | P2 | ✅ done 2026-08-01 | scripts/normalize-shop-order-no.mjs；仅 1 单 I010004→I010001 |
| T264.4 | 端到端真实链路验证（删单不撞号） | test | tf_orders | P1 | ✅ done 2026-08-01 | `scripts/e2e-verify-orderno.mjs`：真实 HTTP 下单 A/B/C(I010001~3) → 硬删中间单 B → 再下单 D。旧逻辑此刻 count+1=3 会撞 C，新逻辑得 I010004 ✅。**7/7 项通过**（格式合规/流水递增/接续历史最大/未撞号/max+1/未回退/全库无重复），测试单已自动清理零残留 |

### T246 — PC 数据看板统计卡对齐修复 — ✅ 2026-08-01

> **PRD**: §3.4  
> **来源**: 用户截图反馈 Dashboard 统计卡内容没对齐。  
> **现象**: 「当前待处理」卡片无环比趋势行，导致三卡数值/图标垂直基准不一致；Statistic 默认 baseline 对齐也使图标与数值未垂直居中。  
> **修复**: 重写 `DashboardStatCard` 为 flex 自定义布局，图标与数值垂直居中，并预留趋势行固定高度，确保三卡结构一致。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T246.1 | DashboardStatCard 自定义 flex 布局 + 趋势行占位 | admin | §3.4 | P2 | ✅ done 2026-08-01 | 去掉 antd Statistic，统一垂直对齐；tsc --noEmit 通过 |
| T246.2 | 两张趋势图并排各占 50%（替代原一窄一宽） | admin | §3.4 | P2 | ✅ done 2026-08-01 | 订单/营收趋势同高同宽；Row 合并 lg={12}+lg={12} |

### T245 — 已支付/售后站内消息 + 商家角标 — ✅ 2026-07-30

> **PRD**: §3.19 / §3.2 / §3.20  
> **来源**: 退款售后后续；已支付新单与取消申请需要站内消息提醒商家。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T245.1 | 支付成功写商家站内消息 order_paid | server/order+inbox | §3.19 / §3.2 | P1 | ✅ done 2026-07-30 | pending_payment→paid；店铺 merchant/admin |
| T245.2 | 取消申请写商家消息 + 处理结果通知顾客 | server/order+inbox | §3.19 / §3.20 | P1 | ✅ done 2026-07-30 | order_cancel_request / approved / rejected |
| T245.3 | status=cancel_request 筛选 + 商家 Tab 角标 | server/client | §3.2 / §4.4 | P1 | ✅ done 2026-07-30 | 售后待处理数 + 待接单数角标 |
| T245.4 | 消息中心订单类跳转 | client/mine | §3.19 | P1 | ✅ done 2026-07-30 | 商家→后台；顾客→订单详情 |
| T245.5 | 文档闭环 | docs | §3.19 | P2 | ✅ done 2026-07-30 | prd/tasks 同步 |
| T245.6 | PC 管理后台「待接单」Tab 实时角标 | admin | §3.4 | P2 | ✅ done 2026-07-31 | 订阅 order:new/paid WS 事件；已支付 Tab 显示实时待接单 Badge |

### T244 — 确认订单页 addresses 重复请求 — ✅ 2026-07-30

> **PRD**: §3.1.3 / §3.12  
> **现象**: 去结算进入确认订单页，Network 出现两次相同 `GET /addresses?shopId=...`。  
> **根因**: 首屏 `useEffect` 与 `useDidShow` 同时触发 `loadDefaultAddress`。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T244.1 | 默认地址只由 useDidShow 拉取 + 并发单飞 | client/order-confirm | §3.1.3 / §3.12 | P1 | ✅ done 2026-07-30 | 去掉 mount 重复调用；ref 防闭包过期；in-flight 去重 |

### T243 — 订单列表「历史」改为「退款售后」 — ✅ 2026-07-30

> **PRD**: §3.1 / §3.20 / §4.4  
> **来源**: 用户反馈「历史」Tab 价值低，改为退款售后入口。  
> **规则**: `status=refund`（同 `after_sale`）→ cancelled/rejected，或 `cancel_requested_at` 非空的取消申请中。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T243.1 | shared 退款售后筛选常量/解析 | shared | §3.20 / §4.4 | P1 | ✅ done 2026-07-30 | CUSTOMER_REFUND_ORDER_STATUSES + isRefundOrderListFilter |
| T243.2 | 服务端 refund 分组（含取消申请中 OR 查询） | server/order | §4.4 | P1 | ✅ done 2026-07-30 | applyOrderStatusQueryFilter；findByUserId/ShopId |
| T243.3 | 顾客端 Tab/空态/卡片售后文案 | client | §3.1 / §3.20 | P1 | ✅ done 2026-07-30 | 历史→退款售后；售后处理中角标 |
| T243.4 | prd/tasks 文档闭环 | docs | §3.20 / §4.4 | P1 | ✅ done 2026-07-30 | API status=refund 说明同步 |
| T243.5 | 详情售后进度面板 + 支付退款态 | client/shared | §3.1 / §3.20 | P1 | ✅ done 2026-07-30 | AfterSalePanel；取消申请/退款步骤；列表原因提示 |
| T243.6 | 商家端/PC 退款售后 Tab 与处理确认 | client/admin + admin | §3.2 / §3.4 / §3.20 | P1 | ✅ done 2026-07-30 | refund Tab；同意并退款确认；售后待处理角标 |

### T242 — 全屏配送地图视口被 includePoints 拉回 — ✅ 2026-07-30

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T242.1 | 全屏地图去掉持续 includePoints，改 MapContext 一次性适配 | client/order-detail, RiderTrackMap | §3.1.4 / §3.17 | P1 | ✅ done 2026-07-30 | 解决缩放立刻回弹；进入全屏冻结中心 |
| T242.2 | 「预估路线/全览轨迹」改为可点击重新适配 | client/order-detail, RiderTrackMap | §3.1.4 / §3.17 | P1 | ✅ done 2026-07-30 | 原状态文案误导成按钮，现真正 fit 路线 |


### T241 — 订单列表时间改为完整年月日时分秒 ✅ 2026-07-30

> **PRD**: §3.1 / §3.20  
> **来源**: 用户反馈「我的订单」列表相对时间（如 6 分钟前）不够直观，要求直接展示完整时间。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T241.1 | OrderCard 时间由 formatRelativeTime 改为 formatTime(YYYY-MM-DD HH:mm:ss) | client | §3.1 | P2 | ✅ done 2026-07-30 | 顾客/骑手共用 OrderCard，列表与骑手页同步生效 |

### T240 — 订单流程优化 ✅ 2026-07-30

> **PRD**: §3.20 / §4.4 / §5.2  
> **范围**: ① 状态机解耦 `ready_for_delivery` ② 待支付超时/商家关单退款 ③ ETA/催单/申请取消 ④ 骑手释放 ⑤ 列表 Tab + 拨号 ⑥ 三端与 PC 同步  
> **迁移**: `docs/migrations/v21-order-flow-optimization.sql`

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T240.1 | DB：ready_for_delivery + ETA/催单/申请取消字段 + RPC | database | §3.20 / §5.1 / §5.2 | P0 | ✅ done 2026-07-30 | v21 迁移；atomic_cancel/atomic_update 对齐；database-init 1.0.6 |
| T240.2 | 服务端状态机/取消/超时/催单/申请取消/释放 | server/order | §3.20 / §4.4 | P0 | ✅ done 2026-07-30 | status 机 + urge/cancel-request/release；5min 超时；estimatedMinutes |
| T240.3 | shared 常量与 actions（状态/Tab/动作文案） | shared | §3.20 / §5.2 | P0 | ✅ done 2026-07-30 | READY_FOR_DELIVERY、流转图与类型字段已落地 |
| T240.4 | 顾客端列表 Tab / 详情催单申请取消 / 拨号 | client | §3.1 / §3.20 | P1 | ✅ done 2026-07-30 | 全部/进行中/待评价/历史（后由 T243 改为退款售后）；一键拨打商家/骑手 |
| T240.5 | 商家端小程序：接单 ETA、处理取消申请、关单 | client/admin | §3.2 / §3.20 | P1 | ✅ done 2026-07-30 | estimatedMinutes；cancel-request resolve |
| T240.6 | 骑手端释放订单回池 | client/rider | §3.3 / §3.20 | P1 | ✅ done 2026-07-30 | release → ready_for_delivery |
| T240.7 | PC 后台订单状态/动作同步 | admin | §3.4 / §3.20 | P1 | ✅ done 2026-07-30 | 新状态展示、取消申请、强制动作对齐 |
| T240.8 | 文档三位一体（prd / tasks / database-init） | docs | §3.20 | P0 | ✅ done 2026-07-30 | 本任务：状态机、API、字段与 T240 看板同步 |

### T239 — 旧地址治理 + 送达体验 + 强制完成 — ✅ 2026-07-30

> **范围**: ① 无坐标地址一键完善/下单拦截 ② 相机必拍 + 距离提示 + 店铺可配围栏 ③ 商家/管理员强制完成（原因+审计）

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T239.1 | 地址列表完善坐标/禁设默认；确认页坐标拦截 | client | §3.1 / §3.3 | P1 | ✅ done 2026-07-30 | 缺坐标角标+一键完善 |
| T239.2 | 店铺 delivery_confirm_radius_m + PC 配置 | server/admin | §3.3 / §3.4 | P1 | ✅ done 2026-07-30 | 默认 500，200~1000 |
| T239.3 | 骑手送达：仅相机 + 店铺围栏预检 + 距离文案 | client/server | §3.3 | P1 | ✅ done 2026-07-30 | sourceType=camera |
| T239.4 | force-complete API + 禁普通 completed + 审计 | server | §3.3 / §3.4 | P1 | ✅ done 2026-07-30 | 原因写入 force_reason |
| T239.5 | 商家小程序/PC 强制完成原因弹窗与凭证展示 | client/admin | §3.2 / §3.4 | P1 | ✅ done 2026-07-30 | 顾客可见强制原因 |

### T238 — 骑手送达地理围栏 + 拍照凭证 — ✅ 2026-07-30


> **需求**: 骑手确认送达时校验与收货地址距离，并强制拍照；顾客与商家均可查看送达信息。
> **设计**:
> - 默认围栏 **500 米**（+ min(定位精度, 50) 缓冲，硬上限 1000 米）
> - 须上传 **1~3 张** 现场照片（`/storage/images/delivery-proof`）
> - 凭证落 `tf_delivery_info`，订单详情返回 `deliveryProof`
> - 客户端预检 + 服务端权威校验；无收货坐标则拒绝确认

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T238.1 | DB 扩展 tf_delivery_info 送达凭证字段 + 远端 migration | database | §3.3 / §5.1 | P1 | ✅ done 2026-07-30 | v19-delivery-proof.sql；order_id UNIQUE |
| T238.2 | 后端 deliver 围栏校验 + 凭证落库 + 详情回传 | server | §3.3 / §4.12 | P1 | ✅ done 2026-07-30 | haversine + DeliverOrderDto |
| T238.3 | 送达照片上传 API（骑手） | server | §3.3 / §4.12 | P1 | ✅ done 2026-07-30 | POST /storage/images/delivery-proof |
| T238.4 | 骑手端：定位预检 + 拍照上传 + 确认送达 | client | §3.3 | P1 | ✅ done 2026-07-30 | chooseMedia 1~3 张 |
| T238.5 | 顾客/商家订单详情与 PC 后台展示送达凭证 | client/admin | §3.1 / §3.2 / §3.4 | P1 | ✅ done 2026-07-30 | 照片预览 + 距离/时间 |
| T238.6 | 地址/下单坐标必填校验 | client/server | §3.3 / §5.1 | P1 | ✅ done 2026-07-30 | 编辑地址地图选点必填；外卖下单无坐标拒单 |

### T237 — 登录失败全局错误 toast 丢失 — ✅ 2026-07-30


> **来源**: 小程序登录错误看不到全局错误拦截 toast
> **根因**: 密码/微信登录失败后端返回业务码 `1004`（UNAUTHORIZED）。`request.ts` 把所有 1004 都当「会话过期」：无 token 时提前 `throw` 且不 toast；登录页 `catch` 为空，用户无任何提示。
> **修复**: ① 仅「请求时已有 token」才走 refresh/logout；无 token 的 1004 走普通业务错误 toast ② 登录/注册 `skipAuthRedirect: true` ③ 业务错误无 message 时也 toast 兜底文案

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T237.1 | request 会话恢复与业务 1004 分流 + toast | client | §3.19 / §4.1 | P0 | ✅ done 2026-07-30 | 无 token 不 silent throw；统一 showErrorToast |
| T237.2 | 登录/注册 skipAuthRedirect | client | §3.19 | P0 | ✅ done 2026-07-30 | wechat-login/login/register |
| T237.3 | 单测覆盖凭证错误 toast | client | §3.19 | P0 | ✅ done 2026-07-30 | request + authStore 24 测全绿 |

### T236 — 审批通过后身份切换入口与消息未读角标 — ✅ 2026-07-30


> **来源**: 骑手申请已通过且消息中心可见，但「我的」页无切换身份入口
> **根因**: ① 前端 roles 缓存未刷新；② 审批 `upsert(onConflict: user_id,role,shop_id)` 与表达式唯一索引不匹配报 42P10，角色未写入却仍发通知
> **策略**: fetchMe 刷新 + ensureUserRole 正确写入 + /auth/me 对已通过申请自愈补写

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T236.1 | 「我的」页 useDidShow 刷新角色 + 未读数 | client/mine | §3.5 / §3.19 | P0 | ✅ done 2026-07-30 | fetchMe + /notifications/unread-count；切换身份面板前置 |
| T236.2 | 冷启动/回前台同步角色 | client | §3.5 | P0 | ✅ done 2026-07-30 | app.tsx restore/fetchMe；消息中心审批通过时 fetchMe 并可回我的 |
| T236.3 | 消息中心菜单未读角标 | client/mine | §3.19 | P1 | ✅ done 2026-07-30 | 右侧红色数字角标，99+ 封顶 |
| T236.4 | 修复审批写入 tf_user_roles 失败（42P10） | server | §3.5 / §3.19 | P0 | ✅ done 2026-07-30 | upsert onConflict 无效；改为 ensureUserRole；/auth/me 自愈补写 |


### T235 — 全局写请求防重复提交（防抖 / 按钮 loading）— ✅ 2026-07-30

> **来源**: 骑手端「我的配送」出现 3 条完全相同订单（同店同菜品同金额），定位为重复提交
> **根因**: ① `client/src/utils/request.ts` 对 POST 等写方法也默认 `retries=1`，弱网超时重试导致服务端二次落库；② `mutation-guard.ts` 两端均存在但从未被引用；③ 页面层普遍用 state/闭包弱守卫，挡不住同 tick 连点
> **策略**: 请求层全局互斥（治本）+ 按钮 loading/disabled（治表，防误触与体验反馈）

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T235.1 | 请求层接线 mutation-guard：写请求同参互斥去重 | client/admin | §4 | P0 | ✅ done 2026-07-30 | 两端 `utils/request.ts` 包装 post/put/patch/del，走 `runExclusiveMutation` |
| T235.2 | 写请求默认不自动重试（仅 GET 保留 retries=1） | client | §4 | P0 | ✅ done 2026-07-30 | 消除重试造成的重复落库，即本次 3 条重复订单主因 |
| T235.3 | 重复提交静默化：`DuplicateSubmitError` 标记已处理 | client/admin | §4 | P0 | ✅ done 2026-07-30 | 加 `__tfErrorHandled`，admin 自动识别；client 页面用 `isDuplicateSubmitError` 早返回 |
| T235.4 | 新增 `useKeyedAsyncAction`（列表按 key 维度强守卫） | client | §3.1 / §3.3 | P0 | ✅ done 2026-07-30 | `useRef<Set>` 判定，配合已有 `useAsyncAction` |
| T235.5 | 切换身份并发防护（authStore + 我的页） | client | §3.5 | P0 | ✅ done 2026-07-30 | 模块级 in-flight 标志 + 按钮「切换中...」+ `is-disabled` |
| T235.6 | 商家端订单状态流转 / 一键接单 / 取消拒单守卫 | client | §3.2 | P0 | ✅ done 2026-07-30 | `admin/index.tsx` 按 `orderId:status` keyed 守卫 + 按钮 loading |
| T235.7 | 顾客端支付 / 取消退款 / 评价 / 再来一单守卫 | client | §3.1 | P1 | ✅ done 2026-07-30 | `order-detail` 四个 `useAsyncAction`，微信取消支付语义保留 |
| T235.8 | 骑手端抢单 / 确认送达按行守卫 | client | §3.3 | P1 | ✅ done 2026-07-30 | `rider/index.tsx` 改用 keyed 守卫，替换原 `actingId` 弱守卫 |
| T235.9 | 菜品管理上下架 / 增删改按钮 loading | client | §3.2 | P2 | ✅ done 2026-07-30 | `menu-manage.tsx` 表单 + 行级双守卫 |
| T235.10 | 收藏 toggle / 地址设为默认与删除 / 通知已读 / 回复评价 | client | §3.1 / §3.5 | P2 | ✅ done 2026-07-30 | 地址 PATCH→POST 兼容回退语义保留 |
| T235.11 | admin 订单行内状态流转按钮 loading | admin | §3.4 | P0 | ✅ done 2026-07-30 | `pendingKeys` Set，仅锁同行不锁全表 |
| T235.12 | admin 桌台弹窗 confirmLoading + 营业状态 Switch loading | admin | §3.4 | P0 | ✅ done 2026-07-30 | 桌台重复创建、营业状态 UI 与实际不一致两个高危点 |
| T235.13 | admin 审批 / 申请 / 消息按钮守卫 | admin | §3.4 | P1 | ✅ done 2026-07-30 | 「通过」建店+改角色副作用；资格校验期穿透窗口 |
| T235.14 | admin 7 处 Popconfirm 删除补 okButtonProps.loading | admin | §3.4 | P2 | ✅ done 2026-07-30 | 行级 `deletingId`，仅当前行 spin |
| T235.15 | `useCrudModal` 上锁提前到表单校验之前 | admin | §3.4 | P1 | ✅ done 2026-07-30 | 收口 Promotion / Menu-Item / ShopManage 创建路径穿透窗口 |
| T235.16 | 修复 admin 既有编译破损（非本任务引入） | admin | §3.4 | P0 | ✅ done 2026-07-30 | Promotion/ShopManage 缺 `}}`、Order 多余 `};`、User `pageSize` 类型、NotificationBell import |
| T235.17 | 双端 tsc 验证零报错 | client/admin | §4 | P0 | ✅ done 2026-07-30 | `client` / `admin` 均 `npx tsc --noEmit` exit 0 |

### P1 — 小程序骨架屏真实 DOM 对齐（T233）— ✅ 2026-07-30

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T233.1 | 全站 SkeletonLoader mode 与真实卡片 DOM 对齐 | client | §3.1 / §3.12 / §3.19 | P1 | ✅ done 2026-07-30 | 新增 review/notification/rider-card；菜单/订单/详情/地址/收藏骨架宽高间距对齐真实列表 |

### P2 — 小程序页面级主按钮底部统一（T232）— ✅ 2026-07-30

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T232.1 | 收藏/地址/订单/我的等页面级主按钮统一底部样式 | client | §3.1 | P2 | ✅ done 2026-07-30 | 复用 FooterBar；收藏「去点餐」对齐地址底部按钮；空态/错误态主 CTA 下沉，tab 页避让自定义 tabBar |

### P1 — 顾客端骑手实时位置与配送负载展示（T231）— ✅ 2026-07-30

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T231.1 | 订单详情下发骑手配送中单量 | server/order | §3.17 / §4.12 | P1 | ✅ done 2026-07-30 | `GET /orders/:id` 对配送中外送单返回 `riderDeliveryCount`，口径为同一骑手 `delivering` 外送单数（含当前单） |
| T231.2 | 配送轨迹实时推送带骑手负载 | server/order, client/socket | §3.17 / §4.12 | P1 | ✅ done 2026-07-30 | `delivery:track` WS payload 增加 `riderDeliveryCount`，顾客端收到定位上报时同步刷新 |
| T231.3 | 顾客订单详情展示骑手位置与待配送单数 | client/order-detail | §3.17 / §3.1.4 | P1 | ✅ done 2026-07-30 | 配送轨迹卡片显示骑手位置更新时间和手上待配送单数；未上报位置时保留待上报状态 |
| T231.4 | 骑手负载统计索引与测试 | database/server | §5.1 / §3.17 | P1 | ✅ done 2026-07-30 | `idx_orders_rider_active_delivery` 支持统计查询；补充配送轨迹服务测试覆盖负载字段 |

### P0 — 骑手端订单可见性与角色入口修复（T230）— ✅ 2026-07-30

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T230.1 | 骑手角色避免停留顾客菜单页 | client/menu, client/auth | §3.1 / §3.3 | P0 | ✅ done 2026-07-30 | 菜单页检测当前角色，骑手自动回接单页；登录页补模拟骑手入口与 rider/rider123 提示 |
| T230.2 | 未分配骑手的配送中外送单进入骑手待抢池 | server/order | §3.3 / §4.4 / §5.2 | P0 | ✅ done 2026-07-30 | 待抢池兼容 preparing 与 delivering 且 rider_id 为空的外送单；抢单时可补写 rider_id |
| T230.3 | 固定测试骑手种子账号 | database/server/auth | §2 / §3.3 | P0 | ✅ done 2026-07-30 | database-init.sql 与内存种子补 rider/rider123，角色为 rider + customer，不绑定店铺 |

### P2 — 小程序我的页入口与申请空态收敛（T229）— ✅ 2026-07-30

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T229.1 | 去掉骑手我的页重复工作台入口 | client/mine | §3.1 / §3.19 | P2 | ✅ done 2026-07-30 | 骑手底部 tab 已直达接单页；我的页不再重复展示「骑手工作台」常用功能卡片 |
| T229.2 | 小程序身份申请去掉资格检查预请求 | client/mine | §3.19 / §4.1 | P2 | ✅ done 2026-07-30 | 移除 `/role-applications/check-eligibility` 防抖调用；基于登录信息 roles + 本人申请记录判断本地提交态，提交接口保留后端兜底 |
| T229.3 | 申请记录空状态统一组件化 | client/mine | §3.19 | P2 | ✅ done 2026-07-30 | 空记录使用公共 EmptyState compact 样式，和其他小程序空态保持一致 |

### P1 — 订单进度状态完成时间（T228）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T228.1 | 订单状态历史表与迁移 | database | §5.1 / §5.2 | P1 | ✅ done 2026-07-29 | 新增 tf_order_status_history；v18 从订单/支付/审计日志回填历史状态；RPC 建单/改状态写历史 |
| T228.2 | 后端订单详情下发 statusHistory | server/order | §4.4 / §5.2 | P1 | ✅ done 2026-07-29 | findById 查询状态历史；建单/支付/取消/商家状态/骑手抢单均记录进入时间；旧库缺表兜底 createdAt/updatedAt |
| T228.3 | 小程序进度条显示完整状态时间 | client/order-detail | §3.1 / §4.4 | P1 | ✅ done 2026-07-29 | 订单详情优先使用 order.statusHistory；StatusTimeline 节点宽度调为 92px，避免时间被裁切 |

### P0 — 购物车失效菜品提交防护（T225）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T225.1 | 下单前同步菜单并清理失效项 | client/order-confirm | §3.1 / §4.4 | P0 | ✅ done 2026-07-29 | 提交前拉取当前菜单 active 项；移除旧购物车中不存在/下架菜品并中断提交，避免 1001 才暴露 |
| T225.2 | 购物车批量移除动作与测试 | client/store | §3.1 | P0 | ✅ done 2026-07-29 | cartStore 增加 removeItems；失效项立即持久化，覆盖旧 storage 混入新菜单场景 |
| T225.3 | 服务端下单校验菜品状态和店铺归属 | server/order | §4.4 / §5.1 | P0 | ✅ done 2026-07-29 | create order 核价前拒绝 inactive 菜品和跨店菜品；补充 order-create-pricing 单测 |

### P0 — 订单待取餐状态约束修复（T221）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T221.1 | 线上 tf_orders_status_check 补 ready_for_pickup | database | §5.1 / §5.2 | P0 | ✅ done 2026-07-29 | 旧 8 态约束导致制作完成失败；已 ALTER 为 9 态；验证 preparing→ready_for_pickup 成功 |
| T221.2 | 增量迁移 v17 落库文档 | docs | §5.1 | P0 | ✅ done 2026-07-29 | docs/migrations/v17-orders-status-ready-for-pickup.sql；database-init.sql 已含 9 态无需改 |

### P2 — 配送方式图标语义优化（T222）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T222.1 | 配送方式 SVG 图标优化 | client/order-confirm | §3.1 | P2 | ✅ done 2026-07-29 | 新增 delivery/pickup/dine-in 专用图标；外卖车简化轮廓、到店自取使用店面、堂食使用盘子刀叉；同步标题和选项引用 |

### P2 — 配送方式图标视觉细化（T223）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T223.1 | 配送方式 SVG 图标第二轮优化 | client/order-confirm | §3.1 | P2 | ✅ done 2026-07-29 | 外卖改为完整小电驴轮廓，到店自取改为手提餐袋，堂食改为盘子配叉勺；减少杂线并统一 24px 视觉重心 |

### P2 — 订单商品明细补图（T226）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T226.1 | 确认订单/订单详情商品明细补图并铺满卡片高度 | client/order-confirm, client/order-detail | §3.1.4 | P2 | ✅ done 2026-07-29 | 两页统一使用 FoodThumb；订单详情补商品图，图片随卡片高度拉伸，详情折叠高度同步上调 |

### P0 — 取消/拒单原因必填（T219）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T219.1 | 数据库增加 cancel_reason / reject_reason | database | §3.1 / §5.1 | P0 | ✅ done 2026-07-29 | tf_orders 新增字段；database-init.sql 同步 |
| T219.2 | 后端 cancel/status 校验并写入原因 | server | §3.1 / §4.4 | P0 | ✅ done 2026-07-29 | cancel 与 rejected 必填 reason；写入 cancel_reason/reject_reason |
| T219.3 | PC 后台拒单/取消原因弹窗 | admin | §3.4 | P0 | ✅ done 2026-07-29 | 弹窗 Form 必填 + 详情展示原因 |
| T219.4 | 小程序顾客取消原因弹层 | client | §3.1.4 | P0 | ✅ done 2026-07-29 | BottomSheet + Textarea 必填；详情展示原因 |

### P1 — 订单列表/进度条布局修复（T216）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T216.1 | 订单列表页底部避让自定义 tabBar | client/order-list | §3.1.4 | P1 | ✅ done 2026-07-29 | page 级 box-sizing + tab-bar-spacer；列表视口不再伸入底栏；ListEndTip 去掉重复 tab 留白 |
| T216.2 | 订单进度条节点真机不对齐 | client/StatusTimeline | §3.1.4 | P1 | ✅ done 2026-07-29 | track 顶对齐；连线绝对定位压中线；label 固定行高，避免当前态字号把圆点顶歪 |
| T217.1 | 菜品列表一次返回 specs，加购不再依赖 /specs | server/client | §3.1.2 / §4 | P1 | ✅ done 2026-07-30 | `GET /menu-items` 批量挂 specs；前端 seed 缓存；有内嵌则不再打 /specs |
| T217.2 | 管理端菜品绑定规格组 + 写回 spec_group_ids | admin/server | §3.2 / §4 | P1 | ✅ done 2026-07-30 | 编辑弹窗多选规格；create/update 持久化；`GET /spec-groups` |
| T217.3 | 演示数据绑定 11 道菜规格 | db | §5 | P2 | ✅ done 2026-07-30 | 口味/份量绑定到羊排、串类等 |
| T217 | 配送轨迹放大查看 | client/order-detail | §3.1.4 | P1 | ✅ done 2026-07-29 | 预览图点击或全屏按钮可放大查看轨迹，包含缩放拖动，includePoints 自动适配视口 |
| T218 | 订单号和下单时间标签值样式对齐 | client/order-detail | §3.1.4 | P1 | ✅ done 2026-07-29 | order-meta__item 改为 flex 结构，label 固定宽度，value 自动伸展 |

### P1 — 订单列表卡片高度修复（T227）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T227.1 | 订单列表卡片改为自适应高度 | client/order-list | §3.1.4 | P1 | ✅ done 2026-07-29 | 移除订单页等高 VirtualList，改用 ScrollView 渲染自然高度卡片；恢复 ListEndTip 的 tab 变体，避免短订单大空白和末卡贴底遮挡 |


### P1 — 菜单滚动回顶修复（T220）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T220.1 | 点击 + / 唤起 picker 列表回顶 | client/menu | §3.1.2 | P1 | ✅ done 2026-07-29 | flushSync 先提交 scrollTop 再 addItem；角标改回父层同批下发；二次回写 + 丢位时 pin 菜品；去掉双滚动 overflow |


### P1 — 菜单加购交互优化（T215）— ✅ 2026-07-29

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T215.1 | 卡片点击开规格 / + 直加购物车 | client | §3.1.2 | P1 | ✅ done 2026-07-29 | MenuItemCard 拆分 onItemClick/onAddClick；+ 用默认规格直加，缺默认必选才开 picker |
| T215.2 | 加购后列表不回顶 | client | §3.1.2 | P1 | ✅ done 2026-07-29 | 初版 scrollTop 回写；残留问题见 T220 |
| T215.3 | 规格弹层打开加速 | client | §3.1.2 | P1 | ✅ done 2026-07-29 | 先开 BottomSheet 再拉规格；本地 specs 缓存；二次打开秒开 |


### P0 — 顾客取消订单权限修复（T214）— ✅ 2026-07-28

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T214.1 | 小程序取消改调 /orders/:id/cancel | client | §3.1 / §4.4 / §5.2 | P0 | ✅ done 2026-07-28 | 原误调商家专用 /status 触发 code 1003；待支付/已支付可自主取消 |
| T214.2 | 取消接口区分顾客与商家身份校验 | server | §4.4 / §5.2 | P0 | ✅ done 2026-07-28 | 顾客传 userId 校验本人；商家/管理员仅店铺访问校验；接单后不可直接取消 |
| T214.3 | 取消规则单测与文档闭环 | server/docs | §3.1 / §4.4 / §5.2 | P0 | ✅ done 2026-07-28 | order-cancel.test.ts；prd 明确顾客自主取消边界 |


### P0 — 后台店铺页双请求与左侧留白（T213）— ✅ 2026-07-28

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T213.1 | shopContext 与 useShops 共用 react-query 缓存 | admin | §3.4 / §3.18 | P0 | ✅ done 2026-07-28 | 顶栏上下文改走 queryKeys.shops.list()，刷新店铺页不再打两次 /api/shops |
| T213.2 | 去掉 PageContainer 与 .tf-page 叠加左内边距 | admin | §3.4 | P0 | ✅ done 2026-07-28 | children-container padding 归零；contentStyle padding 归零，只保留 .tf-page 24px |

### P1 — 菜单搜索改为前端本地过滤（T212）— ✅ 2026-07-28

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T212.1 | 菜单页搜索改本地过滤 | client | §3.1.2 | P1 | ✅ done 2026-07-28 | 保留全量 allCategories 快照；按 name/description 本地过滤；去掉 `/menu-items?search=` 请求；清空搜索恢复全量 |
| T212.2 | 文档同步 search 语义 | docs | §3.1.2 / §4 | P1 | ✅ done 2026-07-28 | prd menu-items 说明改为小程序本地过滤，后端 search 仅兼容保留 |

### P1 — 腾讯地图坐标对齐（T211）— ✅ 2026-07-28

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T211.1 | 店铺/地址/订单坐标字段与 database-init | database/server | §3.17 / §5.1 | P1 | ✅ done 2026-07-28 | tf_shops/tf_addresses lat/lng；tf_orders shop_/delivery_ 快照；schema 1.0.3；线上需 v16 + NOTIFY pgrst reload schema |
| T211.2 | 腾讯地图 geocode 与地址/店铺写入 | server | §3.17 | P1 | ✅ done 2026-07-28 | TENCENT_MAP_KEY；resolveGeoPoint；保存时解析 GCJ-02 |
| T211.3 | 下单快照坐标 + 订单详情真实地图 | server/client | §3.17 / §3.1.4 | P1 | ✅ done 2026-07-28 | 外送快照起终点；去掉杭州假点；无坐标降级 |
| T211.4 | 地址簿选点 + 后台店铺坐标 | client/admin | §3.17 | P1 | ✅ done 2026-07-28 | chooseLocation；admin lat/lng；下单传 delivery 坐标 |

### P1 — 店铺 Logo 自定义上传与默认回退（T210）— ✅ 2026-07-28

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T210.1 | 默认店铺 Logo 资源与解析工具 | client/admin | §3.4 / §3.1 | P1 | ✅ done 2026-07-28 | 提供默认图；空 URL / 加载失败回退 |
| T210.2 | 后台店铺编辑改上传/图库选 Logo | admin | §3.4 / §4.7 | P1 | ✅ done 2026-07-28 | 去掉纯 URL 输入；复用 MediaPicker；列表/选择器预览 |
| T210.3 | 小程序菜单/切店展示自定义 Logo | client | §3.1 | P1 | ✅ done 2026-07-28 | 菜单头像与门店列表使用 ShopLogo |
| T210.4 | 文档与任务闭环 | docs | §3.4 | P1 | ✅ done 2026-07-28 | prd/tasks 同步 |


### P2 — 店铺号与订单号有含义重构（T209）— ✅ 2026-07-28

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T209.1 | tf_shops 新增 shop_no 列并写入有含义编号 | database | §5.1 | P2 | ✅ done 2026-07-28 | 格式 SH+YY+MM+5位顺序号（如 SH260600001）；Supabase ALTER+UPDATE 已执行 |
| T209.2 | tf_orders 批量重新生成 order_no | database | §5.1 | P2 | ✅ done 2026-07-28 | 格式 TF+YYYYMMDD+类型码(D/P/I)+店铺序号2位+流水4位（如 TF20260726D010001）；13条历史订单已更新 |
| T209.3 | 后端 allocateOrderNo 改造 | server | §4.2 | P2 | ✅ done 2026-07-28 | 加入 deliveryType 参数；deliveryTypeCode()/shopSeqNo()/buildOrderNo() 重写；序号统计按类型分维度 |
| T209.4 | 同步 database-init.sql 与文档 | database/docs | §5.1 | P2 | ✅ done 2026-07-28 | tf_shops 加 shop_no 字段定义+增量迁移；order_no 注释更新 |

### P0 — 小程序开发环境请求连通性修复（T208）— ✅ 2026-07-27

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T208.1 | 微信开发者工具模拟器 API 地址改为本机回环 | client/config | §3.1 / §4 | P0 | ✅ done 2026-07-27 | 开发构建默认 API/WS 使用 127.0.0.1，避免模拟器访问局域网 HTTP 地址导致 Network 0B failed；真机调试按注释改局域网 IP |

### P2 — 小程序我的页视觉打磨（T207）— ✅ 2026-07-27

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T207.1 | 我的页头部与功能区样式优化 | client/mine | §3.1 / §3.12 | P2 | ✅ done 2026-07-27 | 头部信息层级、功能入口网格、账号服务列表与身份切换控件统一 token 与间距 |

### P0 — 后台登录首屏与店铺请求收口（T206）— ✅ 2026-07-27

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T206.1 | 登录/注册后权限路由初始化修复 | admin | §3.4 / §3.19 | P0 | ✅ done 2026-07-27 | 持久化会话后整页进入首页，避免首次进入 /dashboard 命中旧权限标记 403 |
| T206.2 | 店铺列表请求去重 | admin | §3.4 / §3.18 | P0 | ✅ done 2026-07-27 | 移除 ShopSelector 重复加载；shopContext 对 StrictMode/并发加载单飞 |

### P0 — 后台登录后权限 403 修复（T205）— ✅ 2026-07-27

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T205.1 | users 接口放开 MERCHANT 权限 | server | §2 / §3.4 / §3.19 | P0 | ✅ done 2026-07-27 | user.controller @Roles(ADMIN)→(ADMIN,MERCHANT)；service 已按 shopId 收敛，商家仅见本店账号，修复 /api/users 返回 code 1003 |
| T205.2 | 平台管理员种子账号 admin/admin123 | server/database | §2 / §5.1 | P0 | ✅ done 2026-07-27 | passwordLogin SEED_PENDING 支持 admin123/merchant123 激活；内存 admin 补 username/passwordHash；database-init.sql 新增 tf_users/tf_user_roles 平台管理员种子（shop_id NULL） |


### P2 — PC 时间展示统一（T204）— ✅ 2026-07-27

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T204.1 | PC 端业务时间统一到年月日时分秒 | admin | §3.4 / §3.18 | P2 | ✅ done 2026-07-27 | admin formatTime 默认 YYYY-MM-DD HH:mm:ss；订单/用户/店铺/促销等展示同步 |


### P1 — 后台店铺菜单整合与看板口径（T203）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T203.1 | 看板订单/已完成/状态分布口径对齐 | admin/server | §3.4 / §3.18 | P1 | ✅ done 2026-07-26 | 状态分布支持 days；区间已完成用分布汇总；待处理标为当前 |
| T203.2 | 店铺管理升一级 + 信息/桌台并入编辑 | admin | §3.4 / §3.18 | P1 | ✅ done 2026-07-26 | 去掉店铺信息/桌台子菜单；编辑含营业时段；桌台抽屉 |
| T203.3 | 平台管理员/商家权限收紧 | admin/server | §2 / §3.18 | P1 | ✅ done 2026-07-26 | 仅平台可建删店；商家仅本店；审计仅平台 |
| T203.4 | 统一用户账号：管理员创建 + 自助改资料 | admin/server | §2 / §3.4 / §3.19 | P1 | ✅ done 2026-07-26 | POST/PATCH users；商家=admin+shopId；本人可改昵称头像 |


### P2 — 顾客我的评价记录（T202）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T202.1 | 后端 listByUser + GET /reviews/mine | server | §3.12 / §4.10 | P2 | ✅ done 2026-07-26 | 按 user_id 分页；内存回退 |
| T202.2 | 顾客「我的评价」列表页 | client | §3.12 / §4.10 | P2 | ✅ done 2026-07-26 | 评分/内容/商家回复；跳转订单详情 |
| T202.3 | 我的页入口 + 文档同步 | client/docs | §3.12 / §4.10 | P2 | ✅ done 2026-07-26 | 顾客常用功能入口；prd/tasks/API |


### P0 — 账号注册登录与角色审批（T201）— ✅ 2026-07-27

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T201.1 | merchant 角色 + 多角色/申请/通知表 + 种子商家 | server/docs/db | §3.19 / §2 | P0 | ✅ done 2026-07-27 | 测试商家已写入 Supabase；v15 迁移已执行 |
| T201.2 | 密码注册/登录/me/switch-role（双 Token） | server | §3.19 / §4.1 | P0 | ✅ done 2026-07-27 | 对齐 family-bookkeeping 会话模型；顾客默认身份 |
| T201.3 | 商家/骑手申请与管理员审批 API | server | §3.19 | P0 | ✅ done 2026-07-27 | 一店一商家；申请前资格/店铺占用校验；驳回可重提 |
| T201.4 | 站内消息通知 API | server | §3.19 | P0 | ✅ done 2026-07-27 | 列表/未读/已读；审批事件写入 |
| T201.5 | PC 登录注册 + 角色分流菜单 | admin | §3.19 / §3.4 | P0 | ✅ done 2026-07-27 | 登录/顾客注册；按角色分流；申请入口资格提示 |
| T201.6 | PC 审批中心 + 消息中心 | admin | §3.19 | P0 | ✅ done 2026-07-27 | 审批通过/驳回；消息中心 |
| T201.7 | 小程序登录注册申请切换（禁 admin） | client | §3.19 / §3.1 | P0 | ✅ done 2026-07-27 | 顾客注册；身份申请/消息/切换；按角色切 tab |
| T201.8 | 权限守卫 merchant 化（全站 Roles） | server | §3.19 / §2 | P0 | ✅ done 2026-07-27 | 商家接口 merchant；平台接口 admin |
| T201.9 | 测试商家顾客视角可切回 | admin/server | §3.19 / §4.1 | P0 | ✅ done 2026-07-27 | 角色列表兜底补 merchant/customer；switch-role 回填 tf_user_roles；PC 切换器补默认顾客选项 |


### P1 — PC 多店铺与统一体验（T200）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T200.1 | 分类等列表搜索栏统一 SearchFilterBar | admin | §3.18 / §3.4 | P1 | ✅ done 2026-07-26 | Category 改 SearchFilterBar + Table，对齐菜品列表 |
| T200.2 | 操作审计中文 + 时间格式 | admin/server | §3.18 / §3.16 / §4.11 | P1 | ✅ done 2026-07-26 | 写入/展示中文；时间 YYYY-MM-DD HH:mm:ss；兼容旧英文 |
| T200.3 | PRD 多店铺角色模型（文档侧） | docs | §2 / §3.18 | P1 | ✅ done 2026-07-26 | 平台管理员/商家/骑手/顾客数据范围；admin 跨店 vs 单店主方案写入 PRD |
| T200.4 | Admin 全局店铺上下文 + 业务页按店过滤 | admin | §3.18 / §3.4 | P1 | ✅ done 2026-07-26 | shopContext + 顶栏 ShopSelector；看板/订单/菜品/分类/促销/店铺/桌台按店 |
| T200.5 | 后端平台管理员跨店查询/商家单店隔离 | server | §3.18 / §2 / §4.2 / §5.1 | P1 | ✅ done 2026-07-26 | 平台 admin 无 shopId 可按 shop_id 查；商家强制本店；菜单/促销/统计支持 |
| T200.6 | 骑手跨店取餐逻辑 | server/client | §3.18 / §2 / §3.3 | P1 | ✅ done 2026-07-26 | findDeliveryPool 跨店；骑手页不传 shop_id；展示店铺名 |
| T200.7 | 顾客切换门店下单 | client | §3.18 / §2 / §3.1 | P1 | ✅ done 2026-07-26 | 菜单顶部门店切换；购物车 setShopId；确认单按当前店 |


### P1 — 状态对齐 / 菜单联动 / 收藏卡片（T199）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T199.1 | 顾客/商家订单状态操作与文案对齐 | client/admin/shared | §5.2 / §3.1.4 / §3.2 | P1 | ✅ done 2026-07-26 | 状态提示映射商家动作；补待取餐/已拒单筛选；shared 流转与 server 一致 |
| T199.2 | 菜单滚动与左侧主菜单联动（含末项） | client/menu | §3.1.2 | P1 | ✅ done 2026-07-26 | offset 含 scrollTop；触底高亮末分类；末项不足一屏补 spacer |
| T199.3 | 收藏页卡片对齐菜单列表（图铺满高） | client/favorites | §3.12 / §3.13 | P1 | ✅ done 2026-07-26 | 左图 stretch 铺满卡片高度，布局对齐 MenuItemCard |


### P1 — 订单详情与全局字号体验打磨（T198）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T198.1 | 标题/菜单/Tab 字号语义上调 | client | §3.12 | P1 | ✅ done 2026-07-26 | $font-title/menu/tab-label 语义别名 |
| T198.2 | 订单列表卡片间距（VirtualList 等高） | client | §3.1.4 | P1 | ✅ done 2026-07-26 | 槽位 padding + 卡片 flex 撑满 |
| T198.3 | 订单进度横向滚动时间轴 | client | §3.1.4 | P1 | ✅ done 2026-07-26 | StatusTimeline 横滑，压缩纵向占位 |
| T198.4 | 配送轨迹地图标注与图例 | client | §3.1.4 | P1 | ✅ done 2026-07-26 | callout 商家/送达；图例色点 |
| T198.5 | 商品明细合并卡片 + 折叠 | client | §3.1.4 | P1 | ✅ done 2026-07-26 | 规格在前金额右置；>3 件展开 |

### P1 — 视觉验收与 quality 全绿（T197）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T197.1 | 关键页文字层级视觉验收 | client | §3.12 | P1 | ✅ done 2026-07-26 | 弱文案升 secondary；非价格强调改 $primary |
| T197.2 | 过期 client 单测对齐 | client | §3.7 | P1 | ✅ done 2026-07-26 | iconMap/authStore/request 全绿 |
| T197.3 | admin 场景色 token 收口 | admin | §3.4 | P1 | ✅ done 2026-07-26 | successSoft/warningSoft/chartAxis |
| T197.4 | quality:check 9/9 全量通过 | root | §3.7 / §6 | P1 | ✅ done 2026-07-26 | 含 weapp+admin build，51.1s |


### P1 — 门店图库批量维护与小程序缓存（T196）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T196.1 | tf_media_assets + batch/list/delete API | server | §4 / §3.4 | P1 | ✅ done 2026-07-26 | shop_id 隔离；batch/list/delete；usedBy；路径 {shopId}/... |
| T196.2 | Admin MediaPicker + 菜品绑图 | admin | §3.4 | P1 | ✅ done 2026-07-26 | MediaPicker 图库弹窗/已用角标/未使用筛选/批量导入；菜品表单主路径选图 + 次要单张；列表缩略图 |
| T196.3 | 种子批量导入 + 小程序菜单图缓存 | client/scripts | §3.1.2 | P1 | ✅ done 2026-07-26 | seed-menu-images.mjs；tf:menu:{shopId} 缓存；dish-images DEPRECATED |


### P1 — 样式变量落地验收与 PC 对齐（T195）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T195.1 | 小程序关键页文字层级验收修复 | client | §3.12 | P1 | ✅ done 2026-07-26 | 补 line-height/字重；标题 tight、正文 normal |
| T195.2 | PC admin 设计令牌对齐小程序 | admin | §3.4 / §3.12 | P1 | ✅ done 2026-07-26 | theme.ts + global.css 语义变量；PriceDisplay 价格色 |
| T195.3 | 文档/AGENTS 索引与提交 | docs | §3.12 | P1 | ✅ done 2026-07-26 | AGENTS 索引 + 本轮变更已提交 |


### P1 — 小程序全局样式变量统一（T194）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T194.1 | 扩展 design-tokens + app 全局排版 | client | §3.12 | P1 | ✅ done 2026-07-26 | 语义色/字号/间距/行高/图标字号 + 全局工具类 |
| T194.2 | 菜单模块样式变量化 | client/menu | §3.1.2 | P1 | ✅ done 2026-07-26 | menu + MenuItemCard/BottomSheet/FoodThumb 等 |
| T194.3 | 订单模块样式变量化 | client/order | §3.1.3 / §3.1.4 | P1 | ✅ done 2026-07-26 | order-list/detail/confirm + OrderCard 等 |
| T194.4 | 我的/登录/地址/收藏样式变量化 | client | §3.1 | P1 | ✅ done 2026-07-26 | mine/auth/address/favorites + EmptyState |
| T194.5 | 商家后台/骑手页样式变量化 | client/admin | §3.2 / §3.3 | P1 | ✅ done 2026-07-26 | admin/* + rider；业务 scss 零裸 hex/字号 |


### P1 — 菜品真实图与缩略图体系（T192）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T192.1 | 本地菜品图资源 21 张 | client | §3.1.2 | P1 | ✅ done 2026-07-26 | assets/dishes 烧烤/素菜/酒水/主食，单张 <150KB |
| T192.2 | dish-images 映射 + FoodThumb 回退链 | client | §3.1.2 | P1 | ✅ done 2026-07-26 | src→菜名→占位；onError 降级；购物车/确认单缩略图 |

### P1 — 空态/骨架/间距体验打磨（T193）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T193.1 | EmptyState 视觉与 compact | client | §3.12 | P1 | ✅ done 2026-07-26 | 渐变图标底、品牌按钮、全页/弹层双密度 |
| T193.2 | Skeleton/文案/间距统一 | client | §3.1 / §3.12 | P1 | ✅ done 2026-07-26 | shimmer 对齐卡片；登录/失败/空列表文案；列表安全区 |


### P3 — 清理过期无引用文件（T190）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T190.1 | 删除过期无引用文件 | docs/client | §3.7 | P3 | ✅ done 2026-07-26 | 删 api.yaml(JWT 过期)、test-connect.js、generate-icons.py、logs 运行日志 |

### P1 — 全站 SVG/Tab 图标语义与观感优化（T189）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T189.1 | 重绘 Icon 组件全部 SVG path | client | §3.1 / §3.12 | P1 | ✅ done 2026-07-26 | 统一 2px 圆角描边；food 去“插头”感；meat 改烤串；分类语义对齐 |
| T189.2 | 新增 cart 并替换购物车误用 | client | §3.1.2 / §3.1.3 | P1 | ✅ done 2026-07-26 | 购物车栏/飞入动画/外卖配送图标改用 cart |
| T189.3 | 重做 tabBar PNG 图标 | client | §3.1 | P1 | ✅ done 2026-07-26 | 菜单刀叉、订单小票、我的头像；灰/品牌色双态 |
| T189.4 | 清除残留 emoji/符号图标 | client/admin | §3.1 / §3.2 / §3.4 | P1 | ✅ done 2026-07-26 | 全站改 SVG/Ant icon；新增 bell/user/users/edit/trash/info/star-filled |


### P1 — 小程序「我的」页集中账号能力（T188）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T188.1 | 新增 mine 页（身份/功能/退出） | client | §3.1 | P1 | ✅ done 2026-07-26 | tabBar「我的」；顾客/商家/骑手菜单分发 |
| T188.2 | 三端入口与登录跳转 | client | §3.1 / §3.2 / §3.3 | P1 | ✅ done 2026-07-26 | admin/rider「我的」入口；登录直达工作台 |
| T188.3 | 移除分散退出与角色浮钮 | client | §3.1 | P1 | ✅ done 2026-07-26 | 删除 AccountBar/RoleSwitcher；能力收敛到 mine |

### P1 — 认证对齐 family-bookkeeping 不透明双 Token（T187）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T187.1 | TokenService + tf_user_sessions | server | §4.1 | P1 | ✅ done 2026-07-26 | Access 2h + Refresh 14d；SHA-256 hash 存会话 |
| T187.2 | AuthService/Guard 去 JWT | server | §4.1 | P1 | ✅ done 2026-07-26 | validate/refresh 查 tf_user_sessions；refresh 默认不轮换 |
| T187.3 | 小程序自动刷新 TTL 对齐 | client | §4.1 | P1 | ✅ done 2026-07-26 | 2h 提前 5m；接口字段仍 token+refreshToken |

### P0 — 订单列表筛选栏与状态对齐（T186）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T186.1 | FilterTabs 样式与激活滚动 | client | §3.1.4 | P0 | ✅ done 2026-07-26 | sticky 白底、inline-flex 横向滚动、激活项 scrollIntoView |
| T186.2 | 订单筛选竞态与状态对齐 | client | §3.1.4 / §4.4 | P0 | ✅ done 2026-07-26 | 请求序号防覆盖、切换即清空、前端兜底过滤、筛选时保留 Tab |


### P1 — 小程序 UI 细节与筛选修复（T185）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T185.1 | 确认订单备注 placeholder 去掉 | client | §3.1.3 | P1 | ✅ done 2026-07-26 | 备注输入框 placeholder 置空，保留快捷标签 |
| T185.2 | 骨架屏与真实 DOM 对齐 | client | §3.1 / §3.12 | P1 | ✅ done 2026-07-26 | 新增 address/favorites/order card/detail 骨架模式 |
| T185.3 | 订单详情样式与时间格式 | client | §3.1.4 | P1 | ✅ done 2026-07-26 | 状态卡分行、进度时间 formatTime、商品/订单号布局、配送轨迹图例 |
| T185.4 | 订单列表 status 筛选修复 | server/client | §3.1.4 / §4.4 | P0 | ✅ done 2026-07-26 | findByUserId 支持 status；顾客列表 Tab 正确过滤 |
| T185.5 | 列表“没有更多了”紧随末项 | client | §3.1.4 | P1 | ✅ done 2026-07-26 | VirtualList footer 内渲染，去掉视口外大空隙 |
| T185.6 | 菜单头部图标化 + 全站 SVG | client/admin | §3.1 / §3.4 | P1 | ✅ done 2026-07-26 | 新增 Icon 组件；收藏/地址/搜索图标按钮；去 emoji |

### P1 — 小程序退出登录入口（T184）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T184.1 | AccountBar 账号条组件 | client | §3.1 | P1 | ✅ done 2026-07-26 | 已由 T188 收敛至「我的」页 |
| T184.2 | 订单/商家/骑手页接入退出 | client | §3.1 / §3.2 / §3.3 | P1 | ✅ done 2026-07-26 | 已由 T188 移除分散入口 |
| T184.3 | 角色切换浮钮可发现性 | client | §3.1 | P1 | ✅ done 2026-07-26 | 已由 T188/T189 删除端内角色切换 |

### P2 — admin 体验与订单号/导出收口（T183）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T183.1 | 看板去重刷新 + 统一搜索/卡片/small/fixed | admin | §3.4 | P2 | ✅ done 2026-07-26 | SearchFilterBar/TableCard/sticky/small/操作列 fixed |
| T183.2 | 订单 Excel 导出 + 业务单号 order_no | admin/server | §3.4 / §4.4 | P2 | ✅ done 2026-07-26 | TF+YYYYMMDD+店铺短码+序号；/orders/export xlsx |
| T183.3 | 错误拦截去重 toast + 促销 shopId 兜底 | admin/server | §3.4 / §4.6 | P2 | ✅ done 2026-07-26 | skipErrorMessage；admin 未绑定店铺 fallback |
| T183.4 | 用户/店铺/桌台/审计页体验统一 | admin | §3.4 / §3.14 / §3.16 | P2 | ✅ done 2026-07-26 | 用户列加宽；桌台按店铺；审计功能已维护 |

### P0 — 创建订单 RPC p_items 类型修复（T182）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T182.1 | 修复 atomic_create_order p_items 传参 | server | §4.4 | P0 | ✅ done 2026-07-26 | 去掉 JSON.stringify，直接传数组；避免 jsonb_array_elements 报 cannot extract elements from a scalar |
| T182.2 | 复现原外送下单请求验收 | server | §4.4 | P0 | ✅ done 2026-07-26 | 烤鸡翅+烤鸡胗外送创建成功，返回 pending_payment |


### P2 — admin 页面头与菜单体验收口（T181）— ✅ 2026-07-26

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T181.1 | 去掉面包屑/描述标题，统一标题+刷新 | admin | §3.4 | P2 | ✅ done 2026-07-26 | 移除 PageContainer 标题描述；全局关闭 breadcrumb；统一 PageHeaderActions |
| T181.2 | 标题栏吸顶 + 分页默认 20 | admin | §3.4 | P2 | ✅ done 2026-07-26 | PageHeaderActions sticky；DEFAULT_PAGE_SIZE=20；订单/用户/审计联动 pageSize |
| T181.3 | 首页去最近订单 + 菜单重排 | admin | §3.4 | P2 | ✅ done 2026-07-26 | Dashboard 移除最近订单；菜单按业务优先级：看板/订单/菜品/促销/用户/店铺/审计 |

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

### P1 — 骑手实时无感定位（T262）— ✅ 2026-07-30

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T262.1 | 骑手定位批量上报接口 | server | §3.17 / §4.12 | P1 | ✅ done 2026-07-30 | `POST /orders/rider/location`；一次定位 fan-out 到该骑手全部配送中外卖单，共享同一 recordedAt，仅 2 次 DB 往返；source 默认 `rider_auto` |
| T262.2 | 骑手端自动定位 hook | client | §3.17 | P1 | ✅ done 2026-07-30 | `useRiderLocationTracker`：startLocationUpdate + onLocationChange，10s/30m 节流、60s 心跳，失败降级 getLocation 轮询；移除「上报位置」按钮，改为实时定位状态条 |
| T262.3 | PC 后台骑手位置面板 | admin | §3.17 | P1 | ✅ done 2026-07-30 | `RiderLocationPanel` 直接展示腾讯地图（服务端静态地图优先，失败降级 map.qq.com iframe）+ 轨迹时间轴 + 外链；socket 实时增量 |
| T262.4 | 小程序商家端骑手位置 | client | §3.17 | P1 | ✅ done 2026-07-30 | 抽出 `RiderTrackMap` 公共组件，商家端订单详情接入 Taro Map + `delivery:track` 实时刷新；顾客端原有链路无需改动 |


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


## 当前进行中

### P1 — PC 管理后台代码与体验优化（T234）✅ 2026-08-01

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T234.1 | 抽离 CSV/Excel 导出工具到 admin/src/utils/export.ts | admin | §3.4 / §3.15 | P2 | ✅ done 2026-07-30 | 已抽离至 utils/export.ts，Order 页仅保留 handleExport |
| T234.2 | 提取通用 useKeywordFilter hook | admin | §3.4 | P2 | ✅ done 2026-07-31 | Order/User/Audit/ShopManage 复用 hooks/useKeywordFilter.ts（已落地） |
| T234.3 | 订单状态操作映射提取到 shared constants | admin/shared | §3.4 / §5.2 | P2 | ✅ done 2026-07-31 | getOrderStatusActions/OrderStatusAction 已落地 shared/src/types；admin/client 复用 |
| T234.4 | Order 页面拆分 hooks 减重 | admin | §3.4 | P2 | ✅ done 2026-07-31 | 拆 hooks/ components/ columns.tsx utils.ts；主文件 <400 行 |
| T234.5 | 硬编码 CSS 数字改为 --tf-space-* 变量 | admin | §3.4 / §3.12 | P2 | ✅ done 2026-08-01 | 全量替换 admin 内联 style / .less / global.css 的 margin/padding/gap 数字为 --tf-space-*；新增半步令牌 space-0_5/1_5/2_5/3_5/4_5（2/6/10/14/18px）覆盖非 4 倍数间距，保证 1:1 视觉等价；tsc --noEmit + jest 41/41 通过；export.ts 导出 HTML 串与 -1px 居中偏移按设计保留硬编码 |
| T234.6 | Dashboard 增加自定义日期范围选择 | admin | §3.4 | P2 | ✅ done 2026-07-31 | DashboardRangeControl 已落地，支持任意日期跨度 |
| T234.7 | Dashboard 增加趋势对比（今日 vs 昨日） | admin | §3.4 | P2 | ✅ done 2026-07-31 | DashboardStatCard/trend.ts 展示变化百分比 + 趋势箭头 |
| T234.8 | 用户管理增加最后登录时间字段 | admin/server | §3.4 / §5.1 | P2 | ✅ done 2026-07-31 | user.service 返回 lastLoginAt（tf_users.last_login_at 由 auth 写入），admin 列表展示 |
| T234.9 | 用户管理分页+搜索优化 | admin | §3.4 | P2 | ✅ done 2026-07-31 | 服务端分页（useUsers({page,pageSize})，后端 user.service 返回 total）+ 服务端关键词/角色搜索（getUsers 新增 keyword 参数，Supabase or ILIKE 匹配 nick_name/id/openid；admin useUsers 透传 keyword/role，移除前端 useKeywordFilter 当前页过滤） |
| T234.10 | 多店铺全量数据看板（平台管理员） | admin | §3.4 / §3.18 | P2 | ✅ done 2026-07-31 | 「全店汇总」选项 + 前端 fan-out 跨店聚合（店铺>5 关闭轮询） |
| T234.11 | 菜品管理批量上架/下架 | admin | §3.4 | P2 | ✅ done 2026-08-01 | 表格 rowSelection + 批量上架/下架按钮已落地；后端 PATCH /api/menu-items/batch-status + useBatchUpdateMenuItemStatus 已接线 |
| T234.12 | 促销管理时间冲突检测 | admin | §3.4 | P2 | ✅ done 2026-08-01 | 创建时检测同类型促销时间段重叠并弹窗提示（代码核查已落地） |
| T234.13 | 消息通知改 WebSocket 推送 | admin/server | §3.4 | P2 | ✅ done 2026-07-31 | inbox pushNotification 增量推 unreadCount（房间 user:${userId}）；前端兜底轮询 |
| T234.14 | 订单详情弹窗增加状态时间线 | admin | §3.4 | P2 | ✅ done 2026-07-30 | OrderStatusProgress 已落地 |


### P2 — 到店自取订单流程体验优化（T263）✅ 2026-08-01

> 背景：自取主链路已通（创建→支付→接单→制作→待取餐→完成），本批补齐联系人、自确认、导航、取餐码与通知等体验缺口。关联 PRD §3.1 / §3.20 / §5.2。

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T263.1 | 自取下单收集联系人/手机号 | client/order-confirm + server | §3.1 / §3.20 | P2 | ✅ done 2026-08-01 | order-confirm 收集 contactName/contactPhone（isValidPhone 校验，auth phone 预填）；下单带入；order-detail/admin 展示并可拨号 |
| T263.2 | 切换配送方式清空桌号残留 | client/order-confirm | §3.1 / §5.2 | P2 | ✅ done 2026-08-01 | deliveryTypeTouchedRef + applyDineContext 守卫；非 DINE_IN 提交时 tableNo 置空（order-confirm:411） |
 | T263.3 | 顾客 ready_for_pickup 自确认取餐 | client/order-detail + server | §3.20 / §5.2 | P2 | done 2026-07-31 | 新增顾客 complete 接口（仅自取/堂食 + ready_for_pickup）；详情页「我已取餐」按钮 |
| T263.4 | 自取详情页门店地址 + 一键导航 | client/order-detail | §3.1 / §3.17 | P2 | ✅ done 2026-08-01 | order-detail:74 Taro.openLocation 一键导航（无坐标降级复制地址） |
| T263.5 | 取餐码展示 + 自取备注快捷标签 | client | §3.1 / §3.20 | P2 | ✅ done 2026-08-01 | pickupCode（orderNo 后 4 位）已接入订单详情/商家端；备注快捷标签 ORDER_REMARK_TAGS_* 已按配送类型接入下单确认页（pickup/dine_in 追加到店时间等标签），点击追加+已选高亮（原记为"后续小优化"，经代码核查实际已落地） |
| T263.6 | ready_for_pickup 状态变更通知 | server/notification + inbox | §3.19 / §5.2 | P2 | ✅ done 2026-08-01 | 进入待取餐写站内消息 type:order_ready_for_pickup（order.service.ts:3145），经 WS notification:new 推送 |


## 将来/暂缓

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T43 | 真实微信支付集成 | payment | §3.5 | P2 | 📋 paused | 暂缓，需企业资质 |
| T181 | 将 docs/database-init.sql 应用到线上 Supabase | database | §5.1 | P1 | ✅ done 2026-08-01 | **只读核查完成**（`scripts/inspect-schema-diff.mjs`）。**纠正旧判断**：26 张 `tf_*` 表一张不缺，7 个 `atomic_*` 函数全部存在且签名一致（旧备注"缺 atomic_*"不成立，订单创建**未**走非事务降级）。实际差异 T181.1–T181.6 已通过 v22/v23/v24/v25/v26 幂等迁移修复并逐批只读验证；规范 `database-init.sql` 已与线上对齐，无需改动 |

#### T181 实际差异清单（2026-08-01 只读核查，未执行任何变更）

| ID | 差异 | 风险 | 实锤证据 | 建议动作 |
|----|------|------|----------|----------|
| T181.1 | `tf_payments` 缺 `updated_at` | **高** | `order.service.ts:2213` `markPaymentsRefunded` 的 UPDATE 带 `updated_at` → 实测返回 `PGRST204`，被 2219 catch 静默吞掉 → **退款状态永不落库**。当前尚无脏数据（17 条支付全 `success`，对应订单无 rejected/cancelled），属"引信已埋未触发" | `ALTER TABLE tf_payments ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();`（已整理为 `docs/migrations/v23-payment-order-missing-columns.sql`，✅ 已执行 2026-08-01，v23→v22 顺序执行；只读核查确认列已存在、历史 `success` 已规范为 `paid`、退款态可落库；端到端回归 PASS：建单→支付→带原因取消，payment.refunded 与 updated_at 均落库） |
| T181.2 | `tf_orders` 缺 `cancel_reason` / `reject_reason` | **高** | 实测 `42703` / `PGRST204`；`order.service.ts:2471` 写取消原因必失败 → 触发 minimal 降级，**售后原因丢失** | `ADD COLUMN IF NOT EXISTS ... text;`（已并入 `docs/migrations/v23-payment-order-missing-columns.sql`，✅ 已执行 2026-08-01，v23→v22 顺序执行；只读核查确认两列已存在；端到端回归 PASS：带原因取消后 tf_orders.cancel_reason 与 updated_at 落库） |
| T181.3 | v22 迁移未执行 | **高** | `docs/migrations/v22-payment-status-paid-refund-compat.sql` 内含 `UPDATE tf_payments SET updated_at=...`，在缺列库上跑不通；线上 17 条支付全 `success`（v22 应规范化为 `paid`）→ 反证未执行。**依赖 T181.1 先做** | 补列后执行 v22 全文（已执行 2026-08-01：v23 补列后执行 v22 全文；支付状态分布现为 paid:19 / refunded:1，success 清零，0 条脏数据） |
| T181.4 | `tf_delivery_info` 结构分叉 | **高** | 缺 `shop_id`/`delivered_at`/`estimated_delivery_at`/`courier_name`/`courier_phone`；线上多出 `type`(NOT NULL 无默认) → 不带 `type` 的 INSERT 必失败，送达凭证走"仅内存保存"降级 | 补列 + `ALTER COLUMN type SET DEFAULT 'delivery'`（已整理为 `docs/migrations/v25-delivery-info-missing-columns.sql`，✅ 已执行+验证 2026-08-01，只读核查确认 5 列补齐、type 列仍在） |
| T181.5 | `tf_users` 缺 `last_login_at` / `updated_at` | 中 | `auth.service.ts:288` `updateLastLoginAt` 整体失效（吞异常），后台"最后登录"永远为空 | 补列（已整理为 `docs/migrations/v24-users-missing-columns.sql`，✅ 已执行+验证 2026-08-01，只读核查确认两列补齐） |
| T181.6 | 三处 `shop_id` 外键缺失 | 中 | `tf_order_items` / `tf_payments` / `tf_users` 有列无 FK。成因：脚本用 `ADD COLUMN IF NOT EXISTS` 补列不带 FK，存量库永远建不出 | 验孤儿行后 `ADD CONSTRAINT`（已整理为 `docs/migrations/v26-shop-id-foreign-keys.sql`，孤儿行=0 已确认，✅ 已执行+验证 2026-08-01，PostgREST 关联嵌入确认三外键生效） |

> **未能确认（REST 探测不到，需人工在 SQL Editor 核查）**：48 个索引 / 9 个 UNIQUE 约束的实际存在情况、各表 CHECK 约束定义（尤其 `tf_payments.status` 是否含 `paid`）、`atomic_*` 七个函数的**函数体版本**（签名一致 ≠ 实现一致，强旁证表明落后于 v22）。
>
> **补齐后可下线的兼容回退代码**：`order.service.ts` 的 `isMissingColumnError`(406) 及 7 处调用点、`updateOrderStatusDirect` minimal 降级(618)、`menu.service.ts` 的 `MENU_ITEM_SELECT_CANDIDATES` 三级降级(29)、`shop.service.ts` 的 `SHOP_SELECT_CANDIDATES`(62)、`payment.service.ts` 多候选 payload 降级(194)。其中 menu/shop 两处**当前即为死代码**，可立即清理。
> **2026-08-01 已完成（C）**：`menu.service.ts`、`shop.service.ts` 的 SELECT 三级降级死代码已删除（保留完整 select 候选 0，调用签名不变），`tsc --noEmit` 0 错误。剩余 `order.service.ts` / `payment.service.ts` 回退仍部分存活（与 minimal 降级耦合，需单独谨慎清理，不在本次 C 范围）。

## 统计

| 状态 | 数量 |
|------|------|
| ⏳ todo | 0 |
| 🔧 in_progress | 0 |
| ✅ done | 380 |
| 🚫 blocked | 0 |
| 📋 paused | 2 |
| **总计** | **382** |

> 说明：T151–T200 已完成；T43 仍为 paused。线上库 schema 落后于 database-init.sql，当前靠服务端兼容回退可演示上线。

### 按优先级分布

| 优先级 | 数量 | 说明 |
|--------|------|------|
| P0 | 73 | ✅ 73 完成 |
| P1 | 173 | ✅ 172 完成 + 📋 1 暂缓 |
| P2 | 135 | ✅ 134 完成 + 📋 1 暂缓 |

### 按模块分布

| 模块 | 数量 | 任务范围 |
|------|------|----------|
| server | 55 | 含安全、订单、营业、地址、评价、审计、配送轨迹、下单核价与测试基线、多店铺隔离（T200.5） |
| client | 50 | 含顾客/商家/骑手小程序体验、性能、测试基线、Sass 模块语法、切换门店（T200.7）与我的页样式打磨（T207/T229/T230/T231） |
| admin | 27 | 含后台页面优化 T234.1–T234.14（新增 14） |
| client/admin | 4 | 小程序与后台共同完成项 |
| server/client | 5 | 后端与小程序共同完成项（含骑手跨店 T200.6、配送负载 T231） |
| database | 5 | 基础数据一致性任务、索引与测试账号种子 |
| 部署 | 7 | Docker/CI/依赖、构建配置与统一质量门禁 |
| docs | 2 | T126、T200.3 多店铺角色 PRD |
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

*最后更新: 2026-08-01 / 2026-07-31（2026-08-01：T247.1 个人中心消息中心卡片去重 ✅；T247.2 修复 SpecGroup 预存类型错误 ✅；T234.11 菜品批量上架/下架 ✅；T234.12 促销时间冲突检测核查已落地 ✅；tasks.md 编号复用清理。2026-07-31：并行 agent 收尾 T234.2/3/4/6/7/8/10/13 ✅；删除重复 T260 编号并入 T234；T234.9 服务端关键词/角色搜索改造 ✅（移除前端 useKeywordFilter，后端 getUsers 新增 keyword ILIKE）；T234.3 移除 client admin 页冗余 getAvailableActions 包装，统一调用 shared getOrderStatusActions ✅；T263.1/2/4/5/6 ✅ 闭环到店自取（T263.5 备注快捷标签 UI 待接入））*

### 近期重构（2026-08-01）

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T247.1 | 个人中心消息中心卡片去重（统一走顶栏铃铛） | admin | §3.19 | P2 | ✅ done 2026-08-01 | 删除 `Account` 的 `MessagesCard`；`/messages` 路由由 redirect 改为真实消息页（`Messages`）；铃铛「查看全部」及非订单消息点击跳转 `/messages`；后端通知接口复用，无新增/删除 |
| T247.2 | 修复 SpecGroup 预存类型错误（重复拼接 + 缺失前端接线） | admin | — | P2 | ✅ done 2026-08-01 | 删除重复副本；补齐 `menu.ts` 的 createSpecGroup/updateSpecGroup/deleteSpecGroup service 与 `useMenuQueries` 对应 hook，导出 `SpecGroup/SpecOption` 类型；页面补 `useShopContext`、`InputNumber` 导入 |

### 2026-08-02 本轮已完成任务

> **PRD 关联**: T301/T303/T306/T307/T308 等
> **状态**: 全部 `done 2026-08-02`（已归档到此文件）

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T301.1 | 角色-店铺写时不变量工具 | common | §3.18 | P1 | ✅ done 2026-08-02 | `assertRoleShopInvariant` / `normalizeShopIdForRole` |
| T301.2 | 账号管理接口接入不变量 | user | §3.18 | P1 | ✅ done 2026-08-02 | createUser 校验前置于 DB 检查 |
| T301.3 | 登录/切角色路径强制归一 | auth | §3.18 | P1 | ✅ done 2026-08-02 | `switchRole`、`wechatLogin` 落库前归一化 |
| T301.4 | 一店一商家冲突友好提示 | user | §3.18 | P2 | ✅ done 2026-08-02 | 唯一索引冲突返回 409 |
| T301.5 | 修复 DEFAULT_SHOP_ID 校验 | user | §3.18 | P1 | ✅ done 2026-08-02 | UUID 形状正则校验 |
| T301.6 | 不变量单测与 HTTP 探针 | test | §3.18 | P1 | ✅ done 2026-08-02 | server/test/user-role-shop-invariant.test.ts |
| T302 | 修复 T300 遗留的陈旧促销测试 | test | §3.18 | P1 | ✅ done 2026-08-02 | 补充“公开控制器不得回流管理态方法”断言 |
| T303 | 语音播报补写 PRD 章节 | docs | §3.22 | P1 | ✅ done 2026-08-02 | 补写 §3.22 功能表/验收口径 |
| T306 | 刷新 PRD §8.2 已知限制 | docs | §8.2 | P2 | ✅ done 2026-08-02 | 所有限制已解决 |
| T307.1 | shopContext 增加全店视角 scope | admin | §3.18/T300 | P1 | ✅ done 2026-08-02 | scope('shop'|'all') |
| T307.2 | 顶栏门店下拉框增加「全店」项 | admin | T300 | P1 | ✅ done 2026-08-02 | ShopSelector 全店项 |
| T307.3 | Dashboard 跟随顶栏视角 | admin | §3.18 | P1 | ✅ done 2026-08-02 | DashboardRangeControl 移除 scope 段控件 |
| T307.4 | 订单列表全店查询（前后端） | admin/server | §3.18 | P1 | ✅ done 2026-08-02 | 前后端支持 allShops |
| T307.5 | 绑定门店模块全店视角提示 | admin | T300 | P2 | ✅ done 2026-08-02 | AllShopsScopeAlert 组件 |
| T308 | 语音播报配置持久化到后端 | admin/server | §3.22 | P2 | ✅ done 2026-08-02 | 话术选择持久化到 tf_shops + 接口 |

**迁移说明**: 以上任务已从 tasks.md 迁移到此归档文件。后续新任务继续在 tasks.md 维护。

