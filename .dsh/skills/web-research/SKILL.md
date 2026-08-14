---
name: web-research
description: 用开源 SearXNG 做联网搜索（失败则 DuckDuckGo），再按需读页面；没有 MCP 时退回 curl，并标明不确定。
whenToUse: 查文档、竞品、MCP 注册表、法规、GitHub 仓库或最新包名时使用。
---

# 调研

优先顺序：

1. 工作区文件与 `toolkit/catalog.json` / `toolkit/mcp-registry.snapshot.json`
2. `mcp__web-search__web_search`：先 [SearXNG](https://github.com/searxng/searxng) 开源元搜索，公开实例失败再解析 DuckDuckGo HTML
3. `mcp__web-search__web_fetch` 读具体页面
4. 自建 SearXNG：`npm run toolkit -- enable searxng`，工具变成 `mcp__searxng__searxng_web_search`
5. 若搜索 MCP 未加载：`MCP_FETCH=1` / `BRAVE_API_KEY` / `MCP_CONTEXT7=1`，或 `curl` / `gh` 公开 API
6. 写明「未在线核实」

`SEARXNG_URL` 可换成自建实例（多个用分号分隔）。不要把公共实例当成私有部署。

禁止把搜到的密钥示例写进仓库。包名以 npm / 官方文档为准。
