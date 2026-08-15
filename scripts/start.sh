#!/usr/bin/env bash
# 启动港窑外贸团队（DeepSeek Harness）。
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
  export DSH_WORKSPACE="${DSH_WORKSPACE:-$ROOT}"
  export GRS_API_KEY="${GRS_API_KEY:-${OPENAI_API_KEY:-}}"
  export GRS_BASE_URL="${GRS_BASE_URL:-https://grsaiapi.com/v1}"
  export GRS_UPSTREAM_BASE_URL="${GRS_UPSTREAM_BASE_URL:-$GRS_BASE_URL}"
  export GRS_TOOL_PROXY_PORT="${GRS_TOOL_PROXY_PORT:-18765}"
  export GRS_TOOL_PROXY_MAX_RETRIES="${GRS_TOOL_PROXY_MAX_RETRIES:-4}"
  export DSH_PERMISSION_MODE="${DSH_PERMISSION_MODE:-danger-full-access}"
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

ensure_user_skills() {
  # Harness 在会话 cwd 不是仓库根时读不到 <project>/.dsh/skills。
  # user-dsh 根是 $DSH_HOME/skills，链到项目 skills 后错误工作区也能加载。
  local dest="${DSH_HOME}/skills"
  local src="$ROOT/.dsh/skills"
  if [[ ! -d "$src" ]]; then
    return 0
  fi
  if [[ -L "$dest" ]]; then
    return 0
  fi
  if [[ -e "$dest" ]]; then
    echo "跳过 skills 链接：${dest} 已存在且不是符号链接"
    return 0
  fi
  ln -sfn "$src" "$dest"
}

ensure_default_workspace() {
  node "$ROOT/scripts/ensure-workspace.mjs"
}

ensure_toolkit() {
  ensure_user_skills
  node "$ROOT/scripts/assemble-toolkit.mjs" sync >/dev/null
}

ensure_tool_proxy() {
  local port="${GRS_TOOL_PROXY_PORT:-18765}"
  if curl -sf "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    echo "GRS 工具代理已在 127.0.0.1:${port}"
    return 0
  fi
  echo "启动 GRS 工具调用代理 127.0.0.1:${port} -> ${GRS_UPSTREAM_BASE_URL}"
  nohup node "$ROOT/scripts/grs-tool-proxy.mjs" >>"$DSH_HOME/grs-tool-proxy.log" 2>&1 &
  local i
  for i in $(seq 1 25); do
    if curl -sf "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  echo "工具代理未能启动，见 $DSH_HOME/grs-tool-proxy.log" >&2
  return 1
}

ensure_public_proxy() {
  if [[ "${DSH_PUBLIC_PROXY:-1}" == "0" ]]; then
    return 0
  fi
  local port="${DSH_PUBLIC_PORT:-3081}"
  if curl -sf "http://127.0.0.1:${port}/__proxy_health" >/dev/null 2>&1; then
    echo "公网反代已在 0.0.0.0:${port} -> 127.0.0.1:${DSH_PORT:-3080}"
    return 0
  fi
  echo "启动公网反代 0.0.0.0:${port} -> 127.0.0.1:${DSH_PORT:-3080}"
  nohup node "$ROOT/scripts/public-proxy.mjs" >>"$DSH_HOME/public-proxy.log" 2>&1 &
  local i
  for i in $(seq 1 25); do
    if curl -sf "http://127.0.0.1:${port}/__proxy_health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  echo "公网反代未能启动，见 $DSH_HOME/public-proxy.log" >&2
  return 1
}

run_dsh() {
  local src="$ROOT/vendor/deepseek-harness"
  local tsx_loader="$src/node_modules/tsx/dist/esm/index.mjs"
  local mcp_patch="${DSH_HOME}/cordis.mcp.patch.yml"
  local ui_patch="$ROOT/plugins/toolkit-panel/cordis.patch.yml"
  local harbor_patch="$ROOT/plugins/harbor-trade/cordis.patch.yml"
  if [[ -f "$src/apps/cli/src/bin.ts" && -f "$tsx_loader" ]]; then
    # 绝对导入 tsx，并钉死 Harness 的 tsconfig，这样 cwd 可以是仓库根。
    export TSX_TSCONFIG_PATH="${TSX_TSCONFIG_PATH:-$src/tsconfig.json}"
    cd "$DSH_WORKSPACE"
    # --patch 必须跟在 launcher 标志里（`web` 之后、`--port` 之前）。
    # 放在 app 参数后面会被 web 命令行当成未知选项。
    if [[ "${1:-}" == "web" ]]; then
      shift
      local patches=()
      if [[ -f "$mcp_patch" ]]; then patches+=(--patch "$mcp_patch"); fi
      if [[ -f "$ui_patch" ]]; then patches+=(--patch "$ui_patch"); fi
      if [[ -f "$harbor_patch" ]]; then patches+=(--patch "$harbor_patch"); fi
      exec node --import "$tsx_loader" "$src/apps/cli/src/bin.ts" web "${patches[@]}" "$@"
    fi
    # headless：MCP + 港窑外贸组合包（含官方 schedule）。不要给无界面会话挂 toolkit-panel UI overlay。
    local patches=()
    if [[ -f "$mcp_patch" ]]; then patches+=(--patch "$mcp_patch"); fi
    if [[ -f "$harbor_patch" ]]; then patches+=(--patch "$harbor_patch"); fi
    if ((${#patches[@]})); then
      exec node --import "$tsx_loader" "$src/apps/cli/src/bin.ts" "${patches[@]}" "$@"
    fi
    exec node --import "$tsx_loader" "$src/apps/cli/src/bin.ts" "$@"
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
    echo "正在重建 Web 前端与对话/模型选择插件以应用品牌..."
    # 这些是运行时 client plugin（lib/client.js），不会进 Vite shell。
    (cd "$src" && pnpm --filter @deepseek-ai/dsh-client-ui-conversation run bundle)
    (cd "$src" && pnpm --filter @deepseek-ai/dsh-client-ui-model-selection run bundle)
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
  echo "== 工具箱 =="
  node "$ROOT/scripts/assemble-toolkit.mjs" doctor
  echo
  echo "== 设置页入口 =="
  if [[ -L "$DSH_HOME/profiles/web/node_modules/codeseek-toolkit-panel" ]]; then
    echo "codeseek-toolkit-panel -> $(readlink "$DSH_HOME/profiles/web/node_modules/codeseek-toolkit-panel")"
    echo "Web 设置 → 插件 → 工具与 MCP"
  else
    echo "尚未链接 codeseek-toolkit-panel（start.sh web 会写入 profile node_modules）"
  fi
  echo
  echo "== Skills =="
  if [[ -L "$DSH_HOME/skills" ]]; then
    echo "dsh-home/skills -> $(readlink "$DSH_HOME/skills")"
  elif [[ -d "$DSH_HOME/skills" ]]; then
    echo "dsh-home/skills: 目录（未链接到 .dsh/skills）"
  else
    echo "dsh-home/skills: 不存在"
  fi
  echo
  echo "== Web 工作区登记 =="
  if [[ -f "$DSH_HOME/storages/workspace.json" ]]; then
    python3 - <<'PY'
import json, os
from pathlib import Path
home = Path(os.environ.get("DSH_HOME", "/workspace/dsh-home")) / "storages/workspace.json"
data = json.loads(home.read_text())
order = data.get("global", {}).get("workspaceIds") or []
rows = data.get("tables", {}).get("workspaces") or {}
for wid in order:
    rec = rows.get(wid) or {}
    print(f"{rec.get('path','?'):<40} title={rec.get('title') or '（空）'}")
PY
  else
    echo "尚无 workspace.json（start.sh web 会写入 $DSH_WORKSPACE）"
  fi
  echo
  echo "== 联网搜索 =="
  if grep -q 'web-search' "$ROOT/toolkit/enabled.json" 2>/dev/null; then
    echo "web-search MCP: enabled.json 已打开（DuckDuckGo → Wikipedia；公开 SearXNG 默认跳过）"
    echo "open-websearch MCP: $(grep -q 'open-websearch' "$ROOT/toolkit/enabled.json" && echo 'enabled.json 已打开' || echo '未强制打开')"
  else
    echo "web-search MCP: 未在 enabled.json（可用 MCP_WEB_SEARCH=1 打开）"
  fi
  echo "SEARXNG_URL: ${SEARXNG_URL:-（未设置；默认跳过公开实例以免 429）}"
  echo
  echo "== GRS 工具代理 =="
  if curl -sf "http://127.0.0.1:${GRS_TOOL_PROXY_PORT:-18765}/health" >/dev/null 2>&1; then
    echo "http://127.0.0.1:${GRS_TOOL_PROXY_PORT:-18765}/health 正常"
  else
    echo "未运行（start.sh web/headless 会自动拉起）"
  fi
  echo
  echo "== 公网反代 =="
  if curl -sf "http://127.0.0.1:${DSH_PUBLIC_PORT:-3081}/__proxy_health" >/dev/null 2>&1; then
    echo "http://127.0.0.1:${DSH_PUBLIC_PORT:-3081}/__proxy_health 正常"
  else
    echo "未运行（start.sh web 会自动拉起 0.0.0.0:${DSH_PUBLIC_PORT:-3081}）"
  fi
  if [[ -z "${GRS_API_KEY:-}" ]]; then
    echo "跳过：没有 GRS_API_KEY"
    return 0
  fi
  local base="${GRS_UPSTREAM_BASE_URL:-${GRS_BASE_URL:-https://grsaiapi.com/v1}}"
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
    ensure_toolkit
    ensure_default_workspace
    ensure_tool_proxy
    ensure_public_proxy
    echo "本机 UI  http://127.0.0.1:${DSH_PORT:-3080}"
    echo "公网入口 http://0.0.0.0:${DSH_PUBLIC_PORT:-3081} （反代到回环 Web；设 DSH_PUBLIC_PROXY=0 可关）"
    echo "工作区请选 codeseek（$DSH_WORKSPACE）；不要选空标题或 /home/ubuntu/go/pkg"
    run_dsh web --port "${DSH_PORT:-3080}" "$@"
    ;;
  headless)
    ensure_from_source
    ensure_toolkit
    ensure_default_workspace
    ensure_tool_proxy
    run_dsh --profile headless "$@"
    ;;
  doctor)
    cmd_doctor
    ;;
  toolkit)
    node "$ROOT/scripts/assemble-toolkit.mjs" "$@"
    ;;
  *)
    echo "未知命令: $CMD" >&2
    echo "用法: scripts/start.sh [web|headless|doctor|toolkit]" >&2
    exit 1
    ;;
esac
