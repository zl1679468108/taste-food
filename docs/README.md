# docs/ 目录说明

## 结构

```
docs/
├── prd.md                      # 产品需求文档 — "要什么"
├── tasks.md                    # 任务看板 — "做什么、做到哪了"
├── database-init.sql           # 数据库初始化脚本（与代码三位一体同步）
├── migrations/                 # 数据库迁移脚本（按版本 v15-v35 + pending）
└── archive/                    # 归档
    ├── tasks-archive-*.md      # 已完成任务快照
    └── decision-records/       # 已结案的决策记录
        └── payment-alternatives.md
```

## 核心文档

| 文件 | 职责 | 关联 |
|------|------|------|
| `prd.md` | 定义"要构建什么"，不涉及执行细节 | 关联 `tasks.md` |
| `tasks.md` | 唯一执行状态源，追踪所有任务 | 关联 `prd.md` 章节 |
| `database-init.sql` | 数据库表结构初始化脚本 | 与代码、迁移三位一体同步 |
| `migrations/` | 增量迁移脚本（已 apply 的保留在目录中） | 对应 `database-init.sql` 版本 |

## 归档

- `archive/tasks-archive-*.md` — 历史任务快照
- `archive/decision-records/` — 已结案的决策/调研记录（如支付方案）
