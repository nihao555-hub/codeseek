# 外贸团队工具箱（优先 GitHub / 官方仓库）

本机装配走 `npm run toolkit -- <cmd>`。目录源是 `toolkit/catalog.json`，
远程 skill 从 GitHub 拉 SKILL.md，MCP 从 npm / GitHub 仓库按需启用。

当前 DeepSeek Harness 子模块钉在上游 `master` **0.1.0-rc.5**
（`47f943859bef60e4160492346772ded9b24f765a`，2026-08-13 npm 公开发布）。
`git fetch origin master` 落后 0 commit，没有可同步的新提交。
vendor 工作树里的品牌覆盖是 `scripts/apply-brand.sh` 的预期脏文件，不要当业务改动提交。

本地 MCP 必须说 **换行 JSON-RPC**（`@modelcontextprotocol/sdk` 的 NDJSON）。
LSP `Content-Length` 会让 `dsh-mcp-client` 握手挂死，工具名永远不会出现。
探测：`node scripts/probe-tools.mjs`。

## DSH 自带、standard 预设已经给模型看的主机工具

这些不是 MCP，来自 `vendor/deepseek-harness` 的 `standard` agent preset。
Web 把工具挂在会话预设上，不是进程全局那一份。

| 工具 | 插件 | 港窑怎么用 | 默认 |
|---|---|---|---|
| `bash` / `read` / `write` / `edit` / `glob` / `grep` | tool-bash, tool-fs, tool-fs-search | 改本仓库、读 catalog | 开 |
| `skill` | tool-skill | 加载 `.dsh/skills/<name>` | 开 |
| `todo_write` / `get_goal` / `job_*` | tool-todo, tool-goal, tool-jobs | 清单、目标、后台作业 | 开 |
| `web_search` | tool-web + 本仓库 `web-search-provider.mjs` | 官方工具名；后端 SearXNG→DuckDuckGo→Wikipedia。公开实例 429 会冷却并静默回退，不把 HTTP 状态写进工具结果 | 开；官方 `web_fetch` **关**（SSRF） |
| `subagent` / `list_agents` / `send_message` / `interrupt_agent` | tool-subagent* | `@花名` 派工 | 开 |
| `report` | tool-subagent-report | 只在 continuable 孩子里；`【花名】已接到\|…` | 开 |
| `ask_user_question` | tool-ask-user | 缺关键信息再问 | 开 |
| `exit_plan_mode` | plan-mode | Web 点 `/plan` 才进计划模式 | 预设已装 |
| `ralph` | tool-ralph | 全新子代理多轮死磕一个 bug；**不要**用来一次拉齐工位 | 预设已装 |
| `workflow` | tool-workflow | 跑部署侧脚本 | 预设已装 |

可选、本仓库默认不挂的 DSH 插件：`lsp`（要语言服务器）、`schedule_*`（定时唤醒）、`terminal_*`（PTY）、`cordis_*`（动态插件，危险）、Exa / Perplexity / DeepSeek 官方搜索（要各自密钥；我们用本地 SearXNG）。

## 已在本机、外贸天天用

| 工具 | 来源 | 作用 | 默认 |
|---|---|---|---|
| web-search | 本仓库 `scripts/web-search-mcp.mjs`；SearXNG → DuckDuckGo → Wikipedia | 买家、展会、竞品公开检索；限流时回退，不把 429 显示给会话 | 开 |
| web_fetch | `mcp__web-search__web_fetch`（官方 web_fetch 关） | 打开买家官网、目录页 | 开 |
| buyer-dd | OpenCorporates API + OpenSanctions API；401 时回退 GLEIF LEI 与 OpenSanctions 公开 HTML | 工商 / LEI / 制裁名单 | 开 |
| sequential-thinking | `github.com/modelcontextprotocol/servers` | 管家拆步骤；首次 `npx` 会下载 | 开 |
| trade-desk / foreign-trade / trade-marketing / trade-dd / … | 本仓库 `.dsh/skills` | 工位派工、港窑人设、公开源背调 | 开 |
| doc-coauthoring / pdf / pptx / xlsx | `github.com/anthropics/skills` | 报价表、画册、介绍信 | 按许可证；docx/pdf/pptx/xlsx **默认不拉**，要办公套件再 `fetch-skills --include-restricted` |
| webapp-testing | `github.com/anthropics/skills` | 独立站走查 | 已拉 |
| internal-comms | `github.com/anthropics/skills` | 对内简报 | 已拉 |
| frontend-design | `github.com/anthropics/skills` | 建站点评 | 已拉 |

## 建议打开（无密钥）

`sequential-thinking` 与 `buyer-dd` 已写入 `toolkit/enabled.json`。

给管家拆「先查买家再写开发信」的步骤；背调用工商库 + 制裁名单，**仍然没有海关提单**。

无密钥但不要默认开：`memory`（知识图谱，污染工具列表）、`context7`（拉库文档，偏开发）、`MCP_TIME=1`（要 `uvx`）。

## 有密钥再开

| 开关 | 仓库 / 包 | 密钥 | 外贸用途 |
|---|---|---|---|
| `MCP_GITHUB=1` | `github.com/github/github-mcp-server` | `GITHUB_PERSONAL_ACCESS_TOKEN` | 拉公开仓库、issue；**不要**给团员写权限 token |
| `MCP_FIRECRAWL=1` | `github.com/mendableai/firecrawl-mcp-server` | `FIRECRAWL_API_KEY` | 深挖买家站点结构 |
| `MCP_BRAVE=1` | Brave Search MCP | `BRAVE_API_KEY` | 比 DuckDuckGo 更稳的检索 |
| `MCP_META_ADS=1` | `github.com/pipeboard-co/meta-ads-mcp` | `META_ACCESS_TOKEN` | 广告专家；新广告必须 PAUSED |

## 先不要默认打开

| 工具 | 原因 |
|---|---|
| Playwright MCP (`MCP_PLAYWRIGHT=1`) | 首次 `npx` 会下整套浏览器，拖慢 Harness 启动。要「打开买家公开页截图」时再开。仓库：`github.com/microsoft/playwright-mcp` |
| 非官方 LinkedIn / 海关库 / 群发 SMTP | 本产品不做爬虫、不代发邮件、没有海关数据。 |
| 社区「marketing-skills」杂包 | 许可证和来源不明，不进 `toolkit/catalog.json`。 |

## 团员怎么用（不要发明工具名）

- 营销 / 询盘：`web_search` → `mcp__web-search__web_fetch` → 对照 `store/data/catalog.json` 写开发信，草稿进 `team/outbox/`。
- 背调：`mcp__buyer-dd__company_search` → `mcp__buyer-dd__sanctions_search` → 官网 `web_fetch`。模板 `team/templates/due-diligence.md`。
- 建站：读 catalog + `webapp-testing` skill；改独立站走本仓库 `store/`。
- 社媒：`trade-social` + 公开检索；不编互动数据。
- 广告：仅在 Meta MCP 就绪时用官方工具；否则只出文案草稿。
- 开发：本仓库代码；GitHub MCP 只读公开资料。难修 bug 可用 `ralph`，不要拿它派外贸工位。

刷新 MCP 注册表（GitHub 上的官方服务器列表缓存）：

```bash
npm run toolkit -- refresh-mcp
node scripts/probe-tools.mjs
```
