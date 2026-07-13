#!/usr/bin/env bash
set -euo pipefail
# 夜间自动化迭代 - 启动脚本
# 用法: ./scripts/run-nightly.sh

REPO_DIR="/Users/zhaolong/前端/vibe-coding-project/taste-food"
LOG_FILE="$REPO_DIR/scripts/nightly-$(date +%Y%m%d_%H%M%S).log"

exec > "$LOG_FILE" 2>&1

echo "=========================================="
echo "🌙 taste-food 夜间自动化迭代启动"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "工作目录: $REPO_DIR"
echo "=========================================="
echo ""

# 切换到项目目录
cd "$REPO_DIR"

echo "自动化已启动。"
echo "日志文件: $LOG_FILE"
echo ""

# 执行夜间自动化迭代脚本
bash "$REPO_DIR/scripts/nightly-automation.sh"
