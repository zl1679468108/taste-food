#!/usr/bin/env bash
# 防重复拉起：若已有本项目 PC 后台 dev 进程在运行，则直接跳过，
# 避免重复执行 `npm start` 拉起多个 UMI dev server。
set -u
PORT="${PORT:-3012}"
PIDFILE="/tmp/tf-admin-${PORT}.pid"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "[dev] 管理后台已在运行 (PID $(cat "$PIDFILE"))，跳过本次启动。"
  echo "[dev] 如需重启，请先结束旧进程: lsof -ti:${PORT} | xargs kill -9"
  exit 0
fi

# 端口被其它进程占用（PID 文件丢失时的兜底），清理后启动
if command -v lsof >/dev/null 2>&1 && lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "[dev] 端口 ${PORT} 被其它进程占用，尝试清理..."
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

cleanup() { rm -f "$PIDFILE"; }
trap cleanup EXIT INT TERM

echo $$ > "$PIDFILE"
PORT="$PORT" max dev
