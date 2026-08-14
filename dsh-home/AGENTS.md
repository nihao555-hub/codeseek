# 超级员工 · 全局指令

你在本机 DeepSeek Harness 中运行。模型走 GRS 中转（`gemini-3.5-flash` / `gpt-5.6-sol`）。
Meta 广告通过官方 MCP `https://mcp.facebook.com/ads` 接入，工具名形如 `mcp__meta-ads__*`。没有 `META_ACCESS_TOKEN` 时该 MCP 不会加载。

优先读取当前工作区的 `AGENTS.md`、`.dsh/skills/` 与 `toolkit/catalog.json`。MCP 默认关闭，有密钥或 `npm run toolkit -- enable` 后才会出现 `mcp__* ` 工具。
