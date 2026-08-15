# codeseek · 超级员工

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的本机 Agent，默认是 **港窑外贸团队**（对齐网易外贸通：管家 + 营销 / 运营 / 建站 / 社媒，并保留询盘报价合规），顺带做广告和改独立站：

- **跨境外贸**：挖客、开发信、询盘、报价、跟单、合规（不代发邮件、没有海关库）
- **Meta 广告**：官方 Ads MCP（`https://mcp.facebook.com/ads`）
- **开发任务**：改这个仓库里的代码与配置
- **港窑独立站**：`store/` 里的跨境家居演示站（Vite + React + Node HTTP）

模型走 GRS 的 OpenAI 兼容中转，默认 `gemini-3.5-flash`，复杂任务可切 `gpt-5.6-sol`。

GRS 目前**不会**返回 OpenAI 原生 `tool_calls`。`scripts/start.sh` 会在本机拉起 `scripts/grs-tool-proxy.mjs`（默认 `http://127.0.0.1:18765/v1`），把工具编进提示词，再把模型输出的 `<tool_call>` 还原成 Harness 能执行的函数调用。上游瞬时失败（例如 `model load is too high`）默认最多再试 3 次。`gpt-5.6-sol` 若把正文写进 `reasoning_content` 或返回空 completion，代理会抬成可见正文并重试，避免 Harness 报 `EMPTY_RESPONSE`。

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

浏览器打开 http://127.0.0.1:3080 。`scripts/start.sh web` 会把仓库根登记成工作区 **codeseek**（`/workspace` 或你 clone 下来的路径）。新会话请选这一项，不要选空标题或 `pkg`。选错时 Agent 仍应读写 `/workspace`，独立站在 `store/`，外贸台账在 `team/`。`scripts/start.sh web` 还会在 `0.0.0.0:3081` 起一层反代（把 Host 改写回回环，避开 Harness 的本机信任栅栏），方便云端端口转发或临时隧道。临时公网：`bash scripts/public-tunnel.sh`（Cloudflare quick tunnel，地址会变）。不需要公网时设 `DSH_PUBLIC_PROXY=0`。

模型选择栏只保留 GRS 的 **Gemini 3.5 Flash** 和 **GPT-5.6 Sol**（带对应 logo）；DeepSeek 官方那几档暂时关掉。

国内直连把 `.env` 里的 `GRS_BASE_URL` 和 `GRS_UPSTREAM_BASE_URL` 改成 `https://grsai.dakka.com.cn/v1`。`dsh-home/settings.yaml` 的 `baseURL` 继续指向本地工具代理。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm start` / `scripts/start.sh web` | 启动 Web UI（本机 :3080，公网反代 :3081） |
| `scripts/start.sh headless "任务"` | 无界面跑一条任务 |
| `scripts/start.sh doctor` | 检查 Node、密钥、GRS 连通、工具代理 |
| `scripts/public-tunnel.sh` | Cloudflare 临时公网 URL（反代 :3081） |
| `npm test` | 工具协议解析单测 + 独立站 API 单测 |
| `npm run store` | 启动港窑独立站（API :8788 + Vite :5173） |
| `npm run store:test` | 只跑独立站测试 |
| `npm run store:build` | 构建独立站前台 |
| `npm run toolkit -- list` | 列出可装配的 skill / MCP / 主机工具 |
| `npm run toolkit -- enable github` | 强制打开某个 MCP 并生成 patch |

首次启动会在 submodule 里执行 `pnpm install` 和 `pnpm run build`，时间较长。

## 港窑独立站

跨境家居演示站：6 个 SKU、中英切换、MOQ 报价、满 $500 免出口操作费、T/T 订金下单、批发询盘。

```bash
cd store && npm install
npm run store          # http://127.0.0.1:5173  （API 在 :8788）
```

约定与 API 说明见 `store/README.md`。Agent 改店面时加载 `.dsh/skills/` 里的前端/后端 skill。

## 外贸团队

默认人设是港窑 **管家**。主会话是企业微信群：输入 `@营销专家 找北欧买家` 指派，团员在后台工位执行，用 `report` 往群里发 `【营销专家】进行中|报错|完成`。花名册 `team/roster.md`，工位剧本 `team/playbooks/wecom.md`。

- 线索池 `team/crm/leads.md`
- 商机看板 `team/pipeline.md`
- 单笔成交 `team/deals/`
- 真实客户隐私 `team/deals/local/`（不提交）
- 四大专家：`trade-marketing` / `trade-ops` / `ecommerce-store` / `trade-social`
- 履约加项：`trade-inquiry` / `trade-quote` / `trade-compliance`

`subagent` 的 description 必须是花名（侧栏和 `@` 列表用它）。产品价格、MOQ、认证只以 `store/data/catalog.json` 为准。不发真实邮件，不编造海关数据和邮箱。

## 装配自己的工具

Skill、MCP、主机工具目录在 `toolkit/catalog.json`。默认 MCP 全关，避免没密钥时拖垮启动。

```bash
npm run toolkit -- list
npm run toolkit -- fetch-skills          # 拉取允许的远程 SKILL.md
npm run toolkit -- enable github sequential-thinking
# 或在 .env 写 GITHUB_TOKEN / MCP_PLAYWRIGHT=1
```

`npm start` 会 sync 并加载 `dsh-home/cordis.mcp.patch.yml`。说明见 `toolkit/README.md`。

## 联网搜索

官方 `standard` preset 给模型的工具名是 `web_search`（`web_fetch` 默认关闭）。本仓库把该工具的后端从 DeepSeek 官方检索换成本地开源搜索：

1. 先查 GitHub 高星开源元搜索 [SearXNG](https://github.com/searxng/searxng)
2. 公开实例失败（限流、关闭 JSON）再解析 DuckDuckGo HTML

读页面仍用 MCP：`mcp__web-search__web_fetch`。备用 MCP 搜索名是 `mcp__web-search__web_search`。

自建 SearXNG 写入 `.env` 的 `SEARXNG_URL`（多个实例用分号分隔）。需要完整 SearXNG MCP（分页、读 URL）时：`npm run toolkit -- enable searxng`，对应 [mcp-searxng](https://github.com/ihor-sokoliuk/mcp-searxng)。关掉默认 MCP 搜索：`npm run toolkit -- disable web-search`。Brave / Firecrawl 仍是可选付费备选。

## 配置在哪

| 路径 | 作用 |
| --- | --- |
| `dsh-home/settings.yaml` | GRS 提供方与默认模型 |
| `dsh-home/cordis.patch.yml` | 人设、默认模型、沙箱；禁用 `llm-deepseek`；`web_search` 后端为 SearXNG |
| `scripts/grs-tool-proxy.mjs` | GRS 文本工具协议 ↔ OpenAI tool_calls |
| `.dsh/skills/` | 外贸 / 广告 / 开发 / 前端 / 后端技能（见该目录 README） |
| `toolkit/catalog.json` | 可装配 skill 与 MCP 目录 |
| `dsh-home/cordis.mcp.patch.yml` | 由 `assemble-toolkit sync` 生成的 MCP 插件层 |
| `AGENTS.md` | 工作区指令 |
| `.env` | 密钥（不要提交） |
| `branding/` | logo、字标、空状态装饰 |

密钥只通过环境变量注入：`GRS_API_KEY`、`META_ACCESS_TOKEN`。

## Meta 广告

1. 在 [Graph API Explorer](https://developers.facebook.com/tools/explorer/) 生成用户令牌，权限至少 `ads_read`；要改广告再加 `ads_management`。
2. 写入 `.env` 的 `META_ACCESS_TOKEN` 后重启。
3. 工具会出现为 `mcp__meta-ads__*`。新建广告默认保持 **PAUSED**。

官方 MCP 也支持 OAuth；本仓库用 Bearer 令牌，方便无浏览器的本机/服务器部署。
