#!/usr/bin/env bash
# 防重复拉起：若已有本项目 dev 进程在运行，则直接跳过，
# 避免短时间内多次执行 `npm run start` 导致两个 nest watch 互杀（死亡螺旋）。
set -u
PORT="${SERVER_PORT:-3010}"
PIDFILE="/tmp/tf-server-${PORT}.pid"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "[dev] 后端已在运行 (PID $(cat "$PIDFILE"))，跳过本次启动。"
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

# ── 代理自适应 ──────────────────────────────────────────────
# 若环境设置了 HTTP(S)_PROXY，则探测该代理端口是否真正可连通（用 /dev/tcp，
# 比 nc 更可靠；本机实测 nc 对 closed 端口也会误报 open）。
# 不可连通时不加 --use-env-proxy，避免 Supabase 等出站请求被无效代理拦截
# 而持续抛 "fetch failed"（本地开发场景最常见）。
# 显式设置了 USE_ENV_PROXY=1 时强制启用，USE_ENV_PROXY=0 时强制禁用。

# 用 bash 内建 /dev/tcp 探测端口是否开放（返回 0=开放）
devtcp_open() {
  local host="$1" port="$2"
  (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null
}

detect_proxy_port() {
  local proxy="${HTTPS_PROXY:-${https_proxy:-${HTTP_PROXY:-${http_proxy:-}}}}"
  [ -z "$proxy" ] && return 1
  local host port
  host="$(printf '%s' "$proxy" | sed -E 's#^[a-zA-Z]+://##; s#/.*$##; s#:.*$##')"
  port="$(printf '%s' "$proxy" | sed -E 's#^[a-zA-Z]+://##; s#/.*$##; s#^[^:]+:##')"
  [ -z "$host" ] || [ -z "$port" ] && return 1
  if devtcp_open "$host" "$port"; then
    return 0
  fi
  return 1
}

# 注意：不要把 supabase.co 加入 NO_PROXY。
# supabase.co 在国内网络需经代理访问，排除出代理会导致直连失败。
# 仅当检测到代理端口不可达时，才跳过 --use-env-proxy 走直连，
# 以避免"代理没开却硬走代理"带来的 fetch failed。

USE_PROXY_FLAG=""
if [ "${USE_ENV_PROXY:-unset}" = "1" ]; then
  USE_PROXY_FLAG="--use-env-proxy"
elif [ "${USE_ENV_PROXY:-unset}" = "0" ]; then
  USE_PROXY_FLAG=""
else
  if detect_proxy_port; then
    USE_PROXY_FLAG="--use-env-proxy"
    echo "[dev] 检测到可用代理，使用 --use-env-proxy。"
  else
    echo "[dev] 未检测到可用代理，跳过 --use-env-proxy（直连外网）。"
  fi
fi
# ───────────────────────────────────────────────────────────

NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }${USE_PROXY_FLAG}" nest start --watch
