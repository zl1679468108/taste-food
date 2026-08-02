-- T300.7 数据订正：双入口改造后消除「role=admin 且 shop_id 非空」的二义账号
--
-- 改造前历史兼容把商家存成 admin + shop_id，导致「平台管理员」与「商家」无法通过
-- role 区分（都要靠 shop_id 是否为空推断）。改造后角色模型明确：
--   - 平台管理员：role = 'admin'    且 shop_id 为空
--   - 商家：     role = 'merchant'  且绑定单一 shop_id（一店一商家）
--
-- 本迁移将历史上「admin + shop_id 非空」的二义账号统一归并为 merchant，消除歧义。
-- 幂等：仅影响 role=admin AND shop_id IS NOT NULL 的行；重复执行安全。

UPDATE tf_users
SET role = 'merchant'
WHERE role = 'admin'
  AND shop_id IS NOT NULL;

-- 执行后校验：应无 role=admin 且 shop_id 非空的行
-- SELECT count(*) FROM tf_users WHERE role = 'admin' AND shop_id IS NOT NULL; -- 期望 0
