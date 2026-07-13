/**
 * 全局共享常量
 *
 * 仅在此处定义默认值，业务代码应优先使用从登录态 / JWT payload 中解析得到的 shopId，
 * 仅在登录态尚未注入或后端未返回 shopId 时回退到 DEFAULT_SHOP_ID。
 */

/**
 * 默认店铺 ID（与 server 端、database-init.sql 中种子数据保持一致）
 * 用于：admin 登录态未携带 shopId 时的回退值
 */
export const DEFAULT_SHOP_ID = '00000000-0000-0000-0000-000000000001';
