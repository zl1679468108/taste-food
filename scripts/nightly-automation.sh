#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# taste-food 夜间自动化迭代脚本
# 功能：完成 PRD/Bug 待办 → 分析新项目 → 发现新需求/Bug → 循环直至收敛
# ============================================================

REPO_DIR="/Users/zhaolong/前端/vibe-coding-project/taste-food"
LOG_FILE="$REPO_DIR/scripts/nightly-$(date +%Y%m%d_%H%M%S).log"
MAX_ITERATIONS=15

log() {
  echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "🚀 taste-food 夜间自动化迭代启动"
log "最大迭代次数: $MAX_ITERATIONS"
log "日志文件: $LOG_FILE"
log ""

cd "$REPO_DIR"

ITERATION=0
while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  
  PENDING_BUGS=$(grep -c "⏳" docs/bug.md 2>/dev/null || echo 0)
  INCOMPLETE_PRD=$(grep -cP '^\[ \]' docs/prd.md 2>/dev/null || echo 0)
  
  log "--- 迭代 $ITERATION/$MAX_ITERATIONS ---"
  log "Bug 待修复: $PENDING_BUGS | PRD 未完成: $INCOMPLETE_PRD"
  
  if [ "$PENDING_BUGS" -eq 0 ] && [ "$INCOMPLETE_PRD" -eq 0 ]; then
    log "✅ 所有待办已完成，停止迭代"
    break
  fi
  
  log "正在启动 Codex 迭代..."
  
  # 调用 Codex CLI 执行本轮迭代
  /Applications/Codex.app/Contents/Resources/codex exec \
    --sandbox danger-full-access \
    --dangerously-bypass-approvals-and-sandbox \
    -C "$REPO_DIR" \
    "你是一个代码审查和修复 Agent。请在 /Users/zhaolong/前端/vibe-coding-project/taste-food 目录下执行：

## 任务
1. 读取 docs/bug.md 和 docs/prd.md，找出所有 ⏳ 标记的待修复 Bug 和 [ ] 标记的未完成功能
2. 逐个修复这些问题，每完成一个就在文档中标记为 ✅
3. 所有待办修复完成后，对整个项目进行全面的代码审查，发现新的 bug 和功能需求
4. 将新发现的问题追加到 bug.md 和 prd.md，标注严重程度
5. 遵循 AGENTS.md 中的代码规范和开发策略
6. 输出本轮摘要：修复了哪些问题、发现了哪些新问题

## 注意事项
- 修复代码后必须同步更新文档
- 新发现的问题要标注严重程度（高/中/低）
- 只修改必要的代码，不要大规模重构" \
    2>&1 | tee -a "$LOG_FILE"
  
  log ""
done

log "🏁 夜间自动化迭代完成"
log "总迭代次数: $ITERATION"
log "日志: $LOG_FILE"
