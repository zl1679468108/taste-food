#!/usr/bin/env bash
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
echo "请在 Codex 桌面应用中继续这个任务。"
echo "脚本会持续迭代直到所有 PRD/Bug 待办完成且没有新发现问题。"
echo ""
echo "按 Ctrl+C 可随时停止。"

# 保持运行，等待 Codex 会话接管
while true; do
  sleep 60
done
