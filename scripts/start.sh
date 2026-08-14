#!/usr/bin/env bash
# 启动超级员工（DeepSeek Harness）。
# 用法：
#   scripts/start.sh web
#   scripts/start.sh headless "今天的任务"
#   scripts/start.sh doctor
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

prefer_node() {
  local nvm_node="$HOME/.nvm/versions/node/v22.22.2/bin"
  if [[ -x "$nvm_node/node" ]]; then
    export PATH="$nvm_node:$PATH"
  elif [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    nvm use 22 >/dev/null 2>&1 || true
  fi
}

load_env() {
  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "$ROOT/.env"
    set +a
  fi
  export DSH_HOME="${DSH_HOME:-$ROOT/dsh-home}"
  export GRS_API_KEY="${GRS_API_KEY:-${OPENAI_API_KEY:-}}"
  mkdir -p "$DSH_HOME/sessions" "$DSH_HOME/profiles"
}

require_node() {
  local major minor
  major="$(node -p "process.versions.node.split('.')[0]")"
  minor="$(node -p "process.versions.node.split('.')[1]")"
  if (( major < 22 || (major == 22 && minor < 19) )); then
    echo "需要 Node.js >= 22.19（当前 $(node -v)）。请先 nvm use 22.22.2" >&2
    exit 1
  fi
}

run_dsh() {
  local src="$ROOT/vendor/deepseek-harness"
  if [[ -f "$src/apps/cli/src/bin.ts" && -d "$src/node_modules/tsx" ]]; then
    exec pnpm --dir "$src" exec -- node --import tsx/esm "$src/apps/cli/src/bin.ts" "$@"
  fi
  if [[ -x "$ROOT/node_modules/.bin/dsh" ]]; then
    exec "$ROOT/node_modules/.bin/dsh" "$@"
  fi
  echo "找不到 dsh。请先在 vendor/deepseek-harness 执行 pnpm install。" >&2
  exit 1
}

ensure_pnpm() {
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
    corepack prepare pnpm@11.7.0 --activate >/dev/null 2>&1 || true
  fi
}

ensure_from_source() {
  local src="$ROOT/vendor/deepseek-harness"
  if [[ ! -f "$src/package.json" ]]; then
    echo "正在浅克隆 deepseek-ai/deepseek-harness ..."
    mkdir -p "$ROOT/vendor"
    git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness.git "$src"
  fi
  ensure_pnpm
  if [[ ! -d "$src/node_modules/tsx" ]]; then
    echo "正在安装 DeepSeek Harness 依赖 ..."
    # submodule 里 lefthook 会改 git config 失败，跳过 git hook 脚本即可运行。
    (cd "$src" && pnpm install --ignore-scripts)
  fi
  if [[ ! -d "$src/apps/cli/lib" || ! -d "$src/apps/web/dist" ]]; then
    echo "正在构建 DeepSeek Harness ..."
    (cd "$src" && pnpm run build)
  fi
  bash "$ROOT/scripts/apply-brand.sh"
  local stamp_src stamp_dst
  stamp_src="$( (cd "$ROOT/branding" && find . -type f ! -name '.applied-stamp' | sort | xargs sha256sum) | sha256sum | awk '{print $1}' )"
  stamp_dst="$ROOT/branding/.applied-stamp"
  if [[ ! -f "$src/apps/web/dist/brand/app-icon.png" || "$(cat "$stamp_dst" 2>/dev/null || true)" != "$stamp_src" ]]; then
    echo "正在重建 Web 前端以应用品牌..."
    (cd "$src" && pnpm --filter @deepseek-ai/dsh-web-frontend run build)
    bash "$ROOT/scripts/apply-brand.sh"
    echo "$stamp_src" > "$stamp_dst"
  fi
}

cmd_doctor() {
  echo "== Node =="
  echo "node $(node -v)  ($(command -v node))"
  echo "pnpm $(pnpm -v 2>/dev/null || echo missing)"
  echo
  echo "== DSH_HOME =="
  echo "$DSH_HOME"
  ls -la "$DSH_HOME"
  echo
  echo "== 源码 =="
  if [[ -f "$ROOT/vendor/deepseek-harness/package.json" ]]; then
    python3 - <<'PY'
import json
p="/workspace/vendor/deepseek-harness/package.json"
print("vendor/deepseek-harness", json.load(open(p)).get("version"))
PY
  else
    echo "vendor/deepseek-harness 未克隆"
  fi
  echo
  echo "== 密钥 =="
  if [[ -n "${GRS_API_KEY:-}" ]]; then
    echo "GRS_API_KEY: 已设置（${#GRS_API_KEY} 字符）"
  else
    echo "GRS_API_KEY: 未设置。复制 .env.example 为 .env 并填写。"
  fi
  if [[ -n "${META_ACCESS_TOKEN:-}" ]]; then
    echo "META_ACCESS_TOKEN: 已设置"
  else
    echo "META_ACCESS_TOKEN: 未设置（Meta MCP 将保持关闭）"
  fi
  echo
  echo "== GRS Chat API =="
  if [[ -z "${GRS_API_KEY:-}" ]]; then
    echo "跳过：没有 GRS_API_KEY"
    return 0
  fi
  local base="${GRS_BASE_URL:-https://grsaiapi.com/v1}"
  local code
  code="$(curl -sS -o /tmp/grs-doctor.json -w "%{http_code}" \
    -H "Authorization: Bearer ${GRS_API_KEY}" \
    -H "Content-Type: application/json" \
    "${base%/}/chat/completions" \
    -d '{"model":"gemini-3.5-flash","stream":false,"messages":[{"role":"user","content":"Reply with the single word pong."}]}' \
    || true)"
  echo "HTTP $code  endpoint ${base%/}/chat/completions"
  python3 - <<'PY'
import json,sys
try:
    data=json.load(open("/tmp/grs-doctor.json"))
except Exception as e:
    print("无法解析响应:", e)
    sys.exit(0)
err=data.get("error") or data.get("message")
if err:
    print("错误:", err if isinstance(err,str) else json.dumps(err,ensure_ascii=False)[:500])
else:
    choice=(data.get("choices") or [{}])[0]
    msg=(choice.get("message") or {}).get("content") or choice.get("delta",{}).get("content")
    print("模型:", data.get("model"))
    print("回复:", (msg or json.dumps(data,ensure_ascii=False)[:400]).strip()[:400])
PY
}

prefer_node
load_env
require_node

CMD="${1:-web}"
if (($# > 0)); then
  shift
fi

case "$CMD" in
  web)
    ensure_from_source
    run_dsh web --port "${DSH_PORT:-3080}" "$@"
    ;;
  headless)
    ensure_from_source
    run_dsh --profile headless "$@"
    ;;
  doctor)
    cmd_doctor
    ;;
  *)
    echo "未知命令: $CMD" >&2
    echo "用法: scripts/start.sh [web|headless|doctor]" >&2
    exit 1
    ;;
esac
