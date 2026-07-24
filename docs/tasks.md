# 任务看板

> **唯一状态源** — 仅维护当前待办、进行中、阻塞与将来/暂缓事项  
> **状态**: `todo` → `in_progress` → `done` | `blocked`  
> **关联**: 每条任务链接到 `prd.md` 对应章节  
> **需求文档**: `docs/prd.md`

---

## 当前待办

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
| T146 | client 菜单联动与虚拟滚动 | client | §3.1 | P2 | ⏳ todo | 菜单分类侧边栏点击→右侧列表滚动联动；右侧列表滚动→左侧分类高亮联动（scroll-into-view）；长列表（菜单/订单列表）引入 Taro VirtualList 虚拟滚动优化性能 |
| T147 | client 内联样式抽离与无障碍 | client | §3.1 | P2 | ⏳ todo | order-confirm 内联 style（flex/gap/fontSize 等）抽离为 SCSS 类名；Image 组件添加 lazyLoad 属性；按钮添加 aria-label 无障碍属性；统一加载/空/错误状态使用 SkeletonLoader/EmptyState/ErrorState 组件 |
| T148 | admin ProComponents 渐进式迁移 | admin | §3.4 | P2 | ⏳ todo | ProTable 替换普通 Table（自带分页/搜索/筛选，可替代 T137+T142 部分工作）；ProForm/ModalForm 替换 Form+Modal；PageContainer 替换 PageHeaderActions；已安装 @ant-design/pro-components 但全项目 0 处使用 |
| T149 | 全局通用 mixin 与工具类 | 全局 | §3.1 | P2 | ⏳ todo | 抽取通用 SCSS mixin（ellipsis/flex-center/hairline/scrollbar-hide）；通用工具类（text-ellipsis/flex-center/safe-area-bottom）；admin 表格列宽规范化（所有列添加 width 属性）；admin 面包屑导航补全（所有页面添加 PageContainer title） |

## 将来/暂缓

| ID | 任务 | 模块 | PRD 关联 | 优先级 | 状态 | 备注 |
|----|------|------|----------|--------|------|------|
| T43 | 真实微信支付集成 | payment | §3.5 | P2 | 📋 paused | 暂缓，需企业资质 |

## 统计

| 状态 | 数量 |
|------|------|
| ⏳ todo | 4 |
| 🔧 in_progress | 0 |
| ✅ done | 56 |
| 🚫 blocked | 0 |
| 📋 paused | 1 |
| **总计** | **61** |

### 按优先级分布

| 优先级 | 数量 | 说明 |
|--------|------|------|
| P0 | 12 | ✅ 12 完成（T135/T136/T137 本轮完成） |
| P1 | 36 | ✅ 36 完成 |
| P2 | 13 | ✅ 8 完成 + ⏳ 4 待办（T146-T149）+ 📋 1 暂缓（真实微信支付） |

### 按模块分布

| 模块 | 数量 | 任务范围 |
|------|------|----------|
| server | 16 | T90, T91-T95, T100-T108, T127-T129 |
| client | 14 | T109-T116, T130, T135, T138-T141, T146-T147 |
| admin | 11 | T96-T97, T117-T122, T131, T137, T142-T144, T148 |
| database | 3 | T123-T125 |
| 部署 | 6 | T98-T99, T132-T134 |
| docs | 1 | T126 |
| 全局 | 3 | T136, T145, T149 |
| payment | 1 | T43 (paused) |

### UI 优化批次执行建议

| 阶段 | 任务 | 目标 |
|------|------|------|
| 1. 基础修复 | T135, T136, T137 | ✅ 已完成：安全区域+品牌色+admin 分页搜索 |
| 2. 组件基建 | T141, T144, T145 | ✅ 公共组件/hooks/tokens 已落地 |
| 3. client 体验 | T138, T139, T140 | ✅ 全部完成 |
| 4. admin 体验 | T142, T143 | ✅ 全部完成 |
| 5. 性能优化 | T146, T147, T148, T149 | 虚拟滚动+无障碍+ProComponents+通用 mixin |

---

*最后更新: 2026-07-24（公共组件/hooks 复用批次）*
