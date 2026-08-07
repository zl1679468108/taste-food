-- v38: 删除两处死表 / 伪需求表（全仓代码零引用）
-- 审查依据：docs/table-pruning-review.md
--   1. tf_refresh_tokens  —— PRD §5.1 标注 [Legacy]，双 Token 已由 tf_user_sessions 承载，零引用
--   2. tf_item_sales      —— 销量统计已由 tf_menu_items.monthly_sales 覆盖，从未被服务接线，零引用
-- 执行方式：Management API POST /v1/projects/{ref}/database/query（PAT），同 v35/v36 流程
-- 幂等：DROP ... IF EXISTS，可重跑

DROP TABLE IF EXISTS tf_refresh_tokens;
DROP TABLE IF EXISTS tf_item_sales;
