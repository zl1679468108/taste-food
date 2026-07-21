/**
 * @taste-food/shared — taste_food_order 三端共享代码
 *
 * 提供三端通用的：
 * - format: 金额/时间/订单号格式化
 * - constants: 枚举、状态映射、DEFAULT_SHOP_ID、状态流转规则
 * - types: 实体类型定义（与 server 端数据库 schema 对齐）
 *
 * 引用方式：
 *   import { formatPrice, OrderStatus, type Order } from '@taste-food/shared';
 *   import { formatPrice } from '@taste-food/shared/format';
 *   import { OrderStatus } from '@taste-food/shared/constants';
 *   import type { Order } from '@taste-food/shared/types';
 */

export * from './format';
export * from './constants';
export * from './types';
