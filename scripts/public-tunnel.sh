#!/usr/bin/env bash
# 把本机 :3081 公网反代打到 Cloudflare quick tunnel。
# 用法：scripts/public-tunnel.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
DSH_HOME="${DSH_HOME:-$ROOT/dsh-home}"
PORT="${DSH_PUBLIC_PORT:-3081}"
BIN="${CLOUDFLARED_BIN:-/tmp/cloudflared}"
LOG="${DSH_HOME}/cloudflared.log"
URL_FILE="${DSH_HOME}/public-url.txt"

mkdir -p "$DSH_HOME"

if ! curl -sf "http://127.0.0.1:${PORT}/__proxy_health" >/dev/null 2>&1; then
  echo "公网反代未在 127.0.0.1:${PORT}。先运行 scripts/start.sh web" >&2
  exit 1
fi

if [[ ! -x "$BIN" ]]; then
  echo "找不到 cloudflared（$BIN）。请安装 Cloudflare cloudflared 或设置 CLOUDFLARED_BIN。" >&2
  exit 1
fi

if curl -sf --max-time 2 "http://127.0.0.1:20241/quicktunnel" >/dev/null 2>&1; then
  host="$(curl -sf --max-time 2 http://127.0.0.1:20241/quicktunnel | python3 -c 'import json,sys; print(json.load(sys.stdin).get("hostname",""))' 2>/dev/null || true)"
  if [[ -n "$host" ]] && curl -sf --max-time 8 "https://${host}/__proxy_health" >/dev/null 2>&1; then
    echo "https://${host}" | tee "$URL_FILE"
    exit 0
  fi
fi

: >"$LOG"
nohup "$BIN" tunnel --url "http://127.0.0.1:${PORT}" >>"$LOG" 2>&1 &
for i in $(seq 1 40); do
  url="$(python3 -c 'import re,sys; from pathlib import Path; text=Path(sys.argv[1]).read_text(errors="ignore"); m=re.search(r"https://[a-z0-9-]+\.trycloudflare.com", text); print(m.group(0) if m else "")' "$LOG")"
  if [[ -n "$url" ]]; then
    echo "$url" | tee "$URL_FILE"
    exit 0
  fi
  sleep 0.3
done

echo "隧道已启动但还没读到 URL，见 $LOG" >&2
exit 1
