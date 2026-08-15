# 工具箱装配

把 DeepSeek Harness 用到的 **skill / MCP / 主机工具** 收成一份目录，按需打开。默认只开获客成交用得上的 MCP（没密钥会拖慢启动、污染工具列表）。**本地联网搜索 `web-search` 默认打开**：官方工具名，后端 DuckDuckGo → Wikipedia，公开 SearXNG 默认不打。读页用 `mcp__web-search__web_fetch`。线索/报价走本仓库 `trade-crm`。

## 一分钟

```bash
npm run toolkit -- list              # 看目录
npm run toolkit -- enable github sequential-thinking
npm run toolkit -- fetch-skills      # 拉取 catalog 里允许的远程 SKILL.md
npm run toolkit -- doctor
npm run probe                        # 活体探测默认 MCP（NDJSON 握手 + 公开 HTTP）
npm start                            # start.sh 会 sync 并 --patch MCP 层
```

本地 stdio MCP 必须说换行 JSON-RPC；LSP `Content-Length` 会让 DSH 客户端挂死。强制打开写在 `toolkit/enabled.json`（搜索、背调、CRM/报价、附件、记忆、时区、sequential-thinking、Context7）。Web 设置 → 插件 → **工具与 MCP** 可开关，改完重启。官方设置页没有 MCP 入口，这个页是本仓库 overlay 插件补上的。外贸闭环见 `team/playbooks/loop.md`。有密钥的服务（`GITHUB_TOKEN`、`META_ACCESS_TOKEN` 等）会自动打开。无密钥服务用 `MCP_PLAYWRIGHT=1` 这类开关。自建 SearXNG 把 `.env` 的 `SEARXNG_URL` 换成你的实例，并可 `npm run toolkit -- enable searxng`。Anthropic `docx`/`pdf`/`pptx`/`xlsx` 是 source-available、不是 Apache，catalog 默认不拉。社区 Cordis 插件对照 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，皮肤/宠物/渗透不装，办公轮子能复用的已收进本仓库 MCP。

生成文件：`dsh-home/cordis.mcp.patch.yml`（不要手改）。许可证：`toolkit/NOTICE.md`。
