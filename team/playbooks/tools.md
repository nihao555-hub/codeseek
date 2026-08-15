# 外贸团队工具箱（优先 GitHub / 官方仓库）

本机装配走 `npm run toolkit -- <cmd>`。目录源是 `toolkit/catalog.json`，
远程 skill 从 GitHub 拉 SKILL.md，MCP 从 npm / GitHub 仓库按需启用。

## 已在本机、外贸天天用

| 工具 | 来源 | 作用 | 默认 |
|---|---|---|---|
| web-search | `@modelcontextprotocol/server-brave-search` 包装；无 Brave key 时走 SearXNG → DuckDuckGo | 买家、展会、竞品公开检索 | 开 |
| web_fetch | DeepSeek Harness 内置 MCP | 打开买家官网、目录页 | 开（Harness） |
| trade-desk / foreign-trade / trade-marketing / trade-social / harbor-kiln | 本仓库 `.dsh/skills` | 工位派工、港窑人设 | 开 |
| doc-coauthoring / pdf / pptx / xlsx | `github.com/anthropics/skills` | 报价表、画册、介绍信 | 按许可证；docx/pdf/pptx/xlsx **默认不拉**，要办公套件再 `fetch-skills --include-restricted` |
| webapp-testing | `github.com/anthropics/skills` | 独立站走查 | 已拉 |
| internal-comms | `github.com/anthropics/skills` | 对内简报 | 已拉 |
| frontend-design | `github.com/anthropics/skills` | 建站点评 | 已拉 |

## 建议打开（无密钥）

```bash
npm run toolkit -- enable sequential-thinking
```

GitHub：`https://github.com/modelcontextprotocol/servers` → `src/sequentialthinking`  
给管家拆「先查买家再写开发信」的步骤，减少一次把整封信写完却没核过 catalog。

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

- 营销 / 询盘：`web_search` → `web_fetch` → 对照 `store/data/catalog.json` 写开发信，草稿进 `team/outbox/`。
- 建站：读 catalog + `webapp-testing` skill；改独立站走本仓库 `store/`。
- 社媒：`trade-social` + 公开检索；不编互动数据。
- 广告：仅在 Meta MCP 就绪时用官方工具；否则只出文案草稿。
- 开发：本仓库代码；GitHub MCP 只读公开资料。

刷新 MCP 注册表（GitHub 上的官方服务器列表缓存）：

```bash
npm run toolkit -- refresh-mcp
```
