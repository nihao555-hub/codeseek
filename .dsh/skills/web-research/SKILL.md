---
name: web-research
description: 用 DuckDuckGo / Open-WebSearch 做联网搜索，再按需读页面；没有 MCP 时退回 curl，并标明不确定。
whenToUse: 查文档、竞品、MCP 注册表、法规、GitHub 仓库或最新包名时使用。
---

# 调研

优先顺序：

1. 工作区文件与 `toolkit/catalog.json` / `toolkit/mcp-registry.snapshot.json`
2. 官方 `web_search`（DuckDuckGo → Wikipedia；公开 SearXNG 默认不打以免 429）
3. `mcp__open-websearch__search`：Aas-ee/open-webSearch，无密钥多引擎
4. `mcp__web-search__web_fetch` 读具体页面
5. 自建 SearXNG：设 `SEARXNG_URL` 或 `npm run toolkit -- enable searxng`
6. 若搜索 MCP 未加载：`MCP_FETCH=1` / `BRAVE_API_KEY` / `MCP_CONTEXT7=1`，或 `curl` / `gh` 公开 API
7. 写明「未在线核实」；回复正文必须列出标题和链接

`SEARXNG_URL` 可换成自建实例（多个用分号分隔）。不要把公共实例当成私有部署。公开实例会 429，默认跳过。

禁止把搜到的密钥示例写进仓库。包名以 npm / 官方文档为准。
