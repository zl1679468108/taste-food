# 小买卖点餐系统

面向线下小餐饮店的扫码点餐微信小程序系统，覆盖从浏览菜单到订单完成的完整交易闭环。

## 项目结构

```
taste-food/
├── client/          # Taro 微信小程序（顾客端/商家端/骑手端）
├── admin/           # PC 管理后台（React + Ant Design Pro + UMI）
├── server/          # NestJS 后端服务
├── docs/            # 项目文档
│   ├── prd.md       # 产品需求文档
│   ├── tasks.md     # 任务看板
│   └── database-init.sql  # 数据库初始化脚本
└── tests/           # 集成测试
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端（小程序） | Taro 4 + React + TypeScript + Zustand |
| 前端（PC 管理后台） | React + Ant Design Pro + UMI |
| 后端 | NestJS + TypeScript |
| 数据库 | Supabase (PostgreSQL) |
| 实时通信 | Socket.io |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 1. 克隆项目

```bash
git clone <repo-url>
cd taste-food
```

### 2. 启动后端

```bash
cd server
npm install
npm run start:dev
# 后端运行在 http://localhost:3010
```

### 3. 启动前端小程序

```bash
cd client
npm install
npm run start
# 小程序运行在 http://localhost:3011
```

### 4. 启动 PC 管理后台

```bash
cd admin
npm install
npm run start
# 管理后台运行在 http://localhost:3012
```

## 功能模块

### 顾客端（小程序）
- 微信登录 / 游客模式 / 角色切换
- 菜单浏览（分类联动、规格选择、加价计算）
- 购物车（持久化、飞入动画）
- 订单管理（下单、支付、取消、再来一单）
- 菜品收藏
- 搜索菜品

### 商家端（小程序）
- 今日营收概览
- 订单管理（接单/拒单、状态流转）
- 菜品管理（CRUD、上下架、图片上传）
- 分类管理
- 用户管理

### 骑手端（小程序）
- 抢单池
- 配送确认

### PC 管理后台
- 数据看板（订单趋势、营收图表）
- 店铺管理（信息编辑、配送范围、多店铺）
- 菜品管理（分类、菜品 CRUD）
- 订单管理（列表、状态筛选、详情）
- 用户管理
- 促销管理

## API 文档

后端 API 统一前缀 `/api/`，响应格式：
```json
{
  "code": 0,
  "data": {},
  "message": "success"
}
```

详细 API 接口见 `docs/prd.md` 第四章。

## 数据库

使用 Supabase (PostgreSQL)，数据库初始化脚本见 `docs/database-init.sql`。

主要表：
- `tf_shops` - 店铺
- `tf_categories` - 分类
- `tf_menu_items` - 菜品
- `tf_orders` - 订单
- `tf_order_items` - 订单项
- `tf_users` - 用户
- `tf_promotions` - 促销活动
- `tf_favorites` - 菜品收藏

## 开发规范

- 金额存储为整数（分）
- API 统一前缀 `/api/`
- 所有业务表含 `shop_id` 字段（多租户预留）
- 任务驱动开发，详见 `docs/tasks.md`

## 许可证

MIT