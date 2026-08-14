---
name: browser-qa
description: 用 Playwright MCP 或手工浏览器验收独立站与 Web UI。
whenToUse: 要点击页面、截图、填表、查控制台，或启用了 MCP_PLAYWRIGHT 时使用。
---

# 浏览器验收

打开 Playwright MCP：

```bash
# .env
MCP_PLAYWRIGHT=1
npm run toolkit -- enable playwright
```

首次 `npx @playwright/mcp` 会下载浏览器，可能较慢。`failOnStartupError` 为 false，没装成功时 Web 仍应能起。

没有 MCP 时：用 `curl` 打 `store` 的 `/api/health`，并说明未做真实点击。

港窑路径：开发 `http://127.0.0.1:5173`，生产 `http://127.0.0.1:8788`。
