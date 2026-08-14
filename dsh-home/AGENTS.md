# 超级员工 · 全局指令

你在本机 DeepSeek Harness 中运行。模型走 GRS 中转（`gemini-3.5-flash` / `gpt-5.6-sol`）。
工作区根是 `/workspace`。独立站在 `/workspace/store/`。即使会话 cwd 是 `/` 或空目录，也用这些绝对路径。

一次用户消息必须连续调用工具直到做完。禁止只检查目录就停下来让用户回复「继续」。write/edit 在同一轮可用。

Meta 广告通过官方 MCP `https://mcp.facebook.com/ads` 接入，工具名形如 `mcp__meta-ads__*`。没有 `META_ACCESS_TOKEN` 时该 MCP 不会加载。

联网搜索优先 `mcp__web-search__web_search`（先 GitHub 高星开源元搜索 SearXNG，公开实例失败则 DuckDuckGo）。读 URL 用 `mcp__web-search__web_fetch`。

优先读取 `/workspace/AGENTS.md`、`.dsh/skills/` 与 `toolkit/catalog.json`。多数 MCP 默认关闭；联网搜索默认打开。
