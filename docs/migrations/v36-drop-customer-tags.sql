-- v36: 移除「顾客标签」子系统（业务判定为伪需求；顾客管理 T313 保留）
--
-- 删除：tf_customer_tag_relations（顾客-标签关联）、tf_customer_tags（标签定义）
-- 保留：tf_messages（站内信，独立功能，不依赖标签）
-- 全部 IF EXISTS，可重复执行。

-- 先删子表（外键引用 tf_customer_tags.id）
DROP TABLE IF EXISTS "tf_customer_tag_relations";

-- 再删标签定义表
DROP TABLE IF EXISTS "tf_customer_tags";
