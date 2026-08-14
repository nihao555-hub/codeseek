---
name: web-research
description: 在没有 Harness web_search 时做公开网页调研：curl、MCP fetch/brave/context7，并标明不确定。
whenToUse: 查文档、竞品、MCP 注册表、法规或最新包名时使用。
---

# 调研

Web overlay 里 `tool-web` 默认 disabled，所以不要假设有 `web_search`。

顺序：

1. 工作区文件与 `toolkit/catalog.json` / `toolkit/mcp-registry.snapshot.json`
2. `MCP_FETCH=1` 或 `BRAVE_API_KEY` / `MCP_CONTEXT7=1` 若已装配
3. `curl` / `gh` 公开 API
4. 写明「未在线核实」

禁止把搜到的密钥示例写进仓库。包名以 npm / 官方文档为准，过时的 `@modelcontextprotocol/server-*` 要再查一眼。
