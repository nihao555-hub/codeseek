# codeseek · 超级员工

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的本机 Agent，用来做外贸、广告、开发，并附带一个可跑的独立站演示：

- **跨境外贸**：询盘、报价、跟单、合规
- **Meta 广告**：官方 Ads MCP（`https://mcp.facebook.com/ads`）
- **开发任务**：改这个仓库里的代码与配置
- **港窑独立站**：`store/` 里的跨境家居演示站（Vite + React + Node HTTP）

模型走 GRS 的 OpenAI 兼容中转，默认 `gemini-3.5-flash`，复杂任务可切 `gpt-5.6-sol`。

GRS 目前**不会**返回 OpenAI 原生 `tool_calls`。`scripts/start.sh` 会在本机拉起 `scripts/grs-tool-proxy.mjs`（默认 `http://127.0.0.1:18765/v1`），把工具编进提示词，再把模型输出的 `<tool_call>` 还原成 Harness 能执行的函数调用。上游瞬时失败（例如 `model load is too high`）默认最多再试 3 次。

## 需要的环境

- Node.js `>= 22.19`（推荐 22.22+）
- pnpm（Harness 源码安装用）
- `GRS_API_KEY`（必填）
- `META_ACCESS_TOKEN`（可选；没有则不加载 Meta MCP）

源码以 git submodule 放在 `vendor/deepseek-harness`。

```bash
git submodule update --init --depth 1 vendor/deepseek-harness
cp .env.example .env   # 填入 GRS_API_KEY
npm start              # 或 bash scripts/start.sh web
```

浏览器打开 http://127.0.0.1:3080 ，选中本仓库作为工作区。

国内直连把 `.env` 里的 `GRS_BASE_URL` 和 `GRS_UPSTREAM_BASE_URL` 改成 `https://grsai.dakka.com.cn/v1`。`dsh-home/settings.yaml` 的 `baseURL` 继续指向本地工具代理。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm start` / `scripts/start.sh web` | 启动 Web UI |
| `scripts/start.sh headless "任务"` | 无界面跑一条任务 |
| `scripts/start.sh doctor` | 检查 Node、密钥、GRS 连通、工具代理 |
| `npm test` | 工具协议解析单测 + 独立站 API 单测 |
| `npm run store` | 启动港窑独立站（API :8788 + Vite :5173） |
| `npm run store:test` | 只跑独立站测试 |
| `npm run store:build` | 构建独立站前台 |

首次启动会在 submodule 里执行 `pnpm install` 和 `pnpm run build`，时间较长。

## 港窑独立站

跨境家居演示站：6 个 SKU、中英切换、MOQ 报价、满 $500 免出口操作费、T/T 订金下单、批发询盘。

```bash
cd store && npm install
npm run store          # http://127.0.0.1:5173  （API 在 :8788）
```

约定与 API 说明见 `store/README.md`。Agent 改店面时加载 `.dsh/skills/` 里的前端/后端 skill。

## 配置在哪

| 路径 | 作用 |
| --- | --- |
| `dsh-home/settings.yaml` | GRS 提供方与默认模型 |
| `dsh-home/cordis.patch.yml` | 人设 + Meta MCP + 工作区根目录 |
| `scripts/grs-tool-proxy.mjs` | GRS 文本工具协议 ↔ OpenAI tool_calls |
| `.dsh/skills/` | 外贸 / 广告 / 开发 / 前端 / 后端技能（见该目录 README） |
| `store/` | Harbor Kiln 演示独立站 |
| `AGENTS.md` | 工作区指令 |
| `.env` | 密钥（不要提交） |
| `branding/` | logo、字标、空状态装饰 |

密钥只通过环境变量注入：`GRS_API_KEY`、`META_ACCESS_TOKEN`。

## Meta 广告

1. 在 [Graph API Explorer](https://developers.facebook.com/tools/explorer/) 生成用户令牌，权限至少 `ads_read`；要改广告再加 `ads_management`。
2. 写入 `.env` 的 `META_ACCESS_TOKEN` 后重启。
3. 工具会出现为 `mcp__meta-ads__*`。新建广告默认保持 **PAUSED**。

官方 MCP 也支持 OAuth；本仓库用 Bearer 令牌，方便无浏览器的本机/服务器部署。
