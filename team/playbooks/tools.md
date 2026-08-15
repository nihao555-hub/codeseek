# 外贸团队工具箱（优先 GitHub / 官方仓库）

本机装配走 `npm run toolkit -- <cmd>`。目录源是 `toolkit/catalog.json`，
远程 skill 从 GitHub 拉 SKILL.md，MCP 从 npm / GitHub 仓库按需启用。

当前 DeepSeek Harness 子模块钉在上游 `master` **0.1.0-rc.5**
（`47f943859bef60e4160492346772ded9b24f765a`，2026-08-13 npm 公开发布）。
`git fetch origin master` 落后 0 commit，没有可同步的新提交。
vendor 工作树里的品牌覆盖是 `scripts/apply-brand.sh` 的预期脏文件，不要当业务改动提交。

**不要重复造轮子。** 搜索、工商、制裁、办公套件用 GitHub 上已经有的高星项目；本仓库只做 DSH 需要的 NDJSON 包装，以及把线索写进 `team/crm/`。不要自研搜索引擎、不要自研 Salesforce、不要自研地图/海关爬虫。

本地 MCP 必须说 **换行 JSON-RPC**（`@modelcontextprotocol/sdk` 的 NDJSON）。
LSP `Content-Length` 会让 `dsh-mcp-client` 握手挂死，工具名永远不会出现。
探测：`node scripts/probe-tools.mjs`。

## 获客成交用的上游轮子（GitHub）

| 干什么 | 用哪个仓库 / API | 本仓库怎么接 |
|---|---|---|
| 公开网页搜索 | [Aas-ee/open-webSearch](https://github.com/Aas-ee/open-webSearch)、DuckDuckGo HTML | `mcp__open-websearch__search`、官方 `web_search` |
| 读买家官网 | 本机 `web_fetch`；更深用 [mendableai/firecrawl](https://github.com/mendableai/firecrawl)（要密钥） | `mcp__web-search__web_fetch`；`MCP_FIRECRAWL=1` |
| 工商登记 | [opencorporates](https://github.com/openc) 公开 API，401 则 [GLEIF/LEI](https://www.gleif.org/) | `mcp__buyer-dd__company_search` |
| 制裁名单 | [opensanctions/opensanctions](https://github.com/opensanctions/opensanctions) | `mcp__buyer-dd__sanctions_search` |
| 拆步骤 | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) sequential-thinking | `mcp__sequential-thinking__*` |
| 完整 CRM 产品 | [twentyhq/twenty](https://github.com/twentyhq/twenty)（5 万星，要 Postgres） | **不在本机拉起**。团员落盘只用 `team/crm/*.json` |
| DSH 插件形态 | 官方 `dsh plugin add` / `@deepseek-ai/dsh-mcp-client` / `dsh-schedule` | 本仓库组合包 `plugins/harbor-trade`（`dsh.bundle`） |
| 外贸硅基军团 MCP | [WangM-A3/silicon-army-mcp](https://github.com/WangM-A3/silicon-army-mcp) | **不装**。含代发邮件和海关 Demo，和本产品红线冲突 |
| 市场体量（不是提单） | 联合国 [Comtrade preview](https://comtradeapi.un.org/public/v1/preview/C/A/HS)；轮子 [uncomtrade/comtradeapicall](https://github.com/uncomtrade/comtradeapicall) | `mcp__trade-open-data__comtrade_preview`。国家×HS×年汇总，**没有进口商公司名** |
| 展会档期 | [LensmorOfficial/trade-show-calendar](https://github.com/LensmorOfficial/trade-show-calendar) 开源 JSON | `mcp__trade-open-data__list_fairs`；失败用 `toolkit/data/trade-shows.json`。仍要打开官网确认 |
| 办公附件 UI | awesome-dsh：`dsh-files` / `dsh-office-tools` / `dsh-cowork` | 审源码再 overlay；读内容走 `mcp__documents__read_document` |

## DSH 自带、standard 预设已经给模型看的主机工具

这些不是 MCP，来自 `vendor/deepseek-harness` 的 `standard` agent preset。
Web 把工具挂在会话预设上，不是进程全局那一份。

| 工具 | 插件 | 港窑怎么用 | 默认 |
|---|---|---|---|
| `bash` / `read` / `write` / `edit` / `glob` / `grep` | tool-bash, tool-fs, tool-fs-search | 改本仓库、读 catalog | 开 |
| `skill` | tool-skill | 加载 `.dsh/skills/<name>` | 开 |
| `todo_write` / `get_goal` / `job_*` | tool-todo, tool-goal, tool-jobs | 清单、目标、后台作业 | 开 |
| `web_search` | tool-web + 本仓库 `web-search-provider.mjs` | 官方工具名。后端 **DuckDuckGo → Wikipedia**，公开 SearXNG 默认不打（429）。点 Search 卡片展开看标题/链接/摘要 | 开；官方 `web_fetch` **关**（SSRF） |
| `subagent` / `list_agents` / `send_message` / `interrupt_agent` | tool-subagent* | `@花名` 派工 | 开 |
| `report` | tool-subagent-report | 只在 continuable 孩子里；`【花名】已接到\|…` | 开 |
| `ask_user_question` | tool-ask-user | 缺关键信息再问 | 开 |
| `exit_plan_mode` | plan-mode | Web 点 `/plan` 才进计划模式 | 预设已装 |
| `ralph` | tool-ralph | 全新子代理多轮死磕一个 bug；**不要**用来一次拉齐工位 | 预设已装 |
| `workflow` | tool-workflow | 跑部署侧脚本 | 预设已装 |
| `schedule_create` / `schedule_list` / `schedule_delete` | `@deepseek-ai/dsh-schedule` + time-context overlay | 用户说每天/每周挖客时建提醒。`every_seconds` 最短 300。只对加载 overlay **之后新建的根会话**生效 | 开（`plugins/schedule/cordis.patch.yml`） |

可选、本仓库默认不挂的 DSH 插件：`lsp`（要语言服务器）、`terminal_*`（PTY）、`cordis_*`（动态插件，危险）、Exa / Perplexity / DeepSeek 官方搜索（要各自密钥；我们用本地 SearXNG）。定时提醒已用官方 `dsh-schedule` overlay 打开。

## 已在本机、外贸天天用

| 工具 | 来源 | 作用 | 默认 |
|---|---|---|---|
| web-search | 本仓库 `scripts/web-search-mcp.mjs`；DuckDuckGo → Wikipedia | 买家、展会、竞品公开检索；默认不打公开 SearXNG | 开 |
| open-websearch | `github.com/Aas-ee/open-webSearch`；本仓库 NDJSON 包装 CLI | 无密钥多引擎（默认 DuckDuckGo，可 Startpage/Bing）。不装 Playwright | 开 |
| web_fetch | `mcp__web-search__web_fetch`（官方 web_fetch 关） | 打开买家官网、目录页 | 开 |
| buyer-dd | OpenCorporates API + OpenSanctions API；401 时回退 GLEIF LEI 与 OpenSanctions 公开 HTML | 工商 / LEI / 制裁名单 | 开 |
| sequential-thinking | `github.com/modelcontextprotocol/servers` | 管家拆步骤；首次 `npx` 会下载 | 开 |
| memory | 本仓库 `scripts/memory-mcp.mjs` | 本地图谱备忘，不写客户隐私 | 开 |
| time | 本仓库 `scripts/time-mcp.mjs` | 时区转换 | 开 |
| documents | 本仓库 `scripts/documents-mcp.mjs` | 读工作区 md/docx/xlsx/pdf | 开 |
| trade-crm | 本仓库 `scripts/trade-crm-mcp.mjs` | 线索 / 商机 / 目录报价 / 开发信草稿（不代发） | 开 |
| trade-open-data | 本仓库 `scripts/trade-open-data-mcp.mjs` | 一句话开干 `kickoff`；UN Comtrade preview；GitHub 展会日历 | 开 |
| context7 | `@upstash/context7-mcp` | 按库名拉最新官方文档 | 开 |
| trade-desk / foreign-trade / trade-marketing / trade-dd / … | 本仓库 `.dsh/skills` | 工位派工、港窑人设、公开源背调 | 开 |
| doc-coauthoring / pdf / pptx / xlsx | `github.com/anthropics/skills` | 报价表、画册、介绍信 | 按许可证；docx/pdf/pptx/xlsx **默认不拉**，要办公套件再 `fetch-skills --include-restricted` |
| webapp-testing | `github.com/anthropics/skills` | 独立站走查 | 已拉 |
| internal-comms | `github.com/anthropics/skills` | 对内简报 | 已拉 |
| frontend-design | `github.com/anthropics/skills` | 建站点评 | 已拉 |

## 建议打开（无密钥）

`sequential-thinking`、`buyer-dd`、`memory`、`time`、`documents`、`context7`、`trade-crm`、`trade-open-data` 已写入 `toolkit/enabled.json`。

Web **设置 → 插件 → 工具与 MCP** 可以开关 MCP（官方设置页没有这个入口，本仓库 overlay 补上）。改完重启 Web。

给管家拆「先查买家再写开发信」的步骤；背调用工商库 + 制裁名单。市场体量用 Comtrade **汇总统计**，**仍然没有海关提单**。本地记忆不要写客户隐私。询盘 PDF/DOCX 用 `mcp__documents__read_document`。

无密钥但不要默认开：`filesystem`（和 read/write 重复）、Playwright（要下载浏览器，在设置页再开）。Context7 已默认打开（建站专家查库文档用，不是给全能开发准备的）。

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
| 非官方 LinkedIn / 海关提单库 / 群发 SMTP | 本产品不做爬虫、不代发邮件。Comtrade preview 只给国家×HS 汇总，不是提单。 |
| 地图抓取 / Google Maps scraper | 不做。获客走公开网页搜索 + 工商库，不另写一套地图爬虫。 |
| 社区「marketing-skills」杂包 | 许可证和来源不明，不进 `toolkit/catalog.json`。 |

## 团员怎么用（不要发明工具名）

- 营销：`kickoff` 后 `mcp__trade-crm__search_queries` → `web_search` → `mcp__web-search__web_fetch` → `upsert_lead`；开发信 `draft_outreach`（不代发）。市场体量 `mcp__trade-open-data__comtrade_preview`。展会 `list_fairs`。
- 询盘 / 报价：`mcp__trade-crm__quote_catalog`（口头品类对 catalog SKU）→ `upsert_deal`（必须写出 `team/deals/<id>.md`）。数字只来自 `store/data/catalog.json`，不是买家官网标价。
- 运营：用户点名「已发出/回了」用 `mcp__trade-crm__record_reply`；`list_leads` / `list_deals` 分层跟进；触达只允许 draft / user-sent / replied。
- 背调：`mcp__buyer-dd__company_search` → `mcp__buyer-dd__sanctions_search` → 官网 `web_fetch`。模板 `team/templates/due-diligence.md`。
- 建站：读 catalog + `webapp-testing` skill；独立站是获客货架，走本仓库 `store/`。
- 社媒：`trade-social` + 公开检索；不编互动数据、不登录对方后台。
- 广告：仅在 Meta MCP 就绪时用官方工具；否则只出文案草稿。
- 没有开发工位。用户要写无关代码就拒绝；难修的独立站获客页可由建站专家用 `ralph`，不要拿它派外贸工位。

刷新 MCP 注册表（GitHub 上的官方服务器列表缓存）：

```bash
npm run toolkit -- refresh-mcp
node scripts/probe-tools.mjs
```
