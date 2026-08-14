---
name: mcp-integration
description: 把外部 MCP 接到 DeepSeek Harness：stdio / streamable-http、serverName、密钥、失败不阻断启动。
whenToUse: 新增或调试 MCP 服务器、工具名 mcp__* 看不到、或连接失败时使用。
---

# MCP 接入

Harness 用 `@deepseek-ai/dsh-mcp-client`，每个服务器一条 plugin。本仓库经 `toolkit/catalog.json` → `assemble-toolkit sync` → `dsh-home/cordis.mcp.patch.yml` 插入。

## 规则

- `serverName`：`[A-Za-z0-9_-]{1,32}`，进程内唯一。重复会启动失败。
- 传输：`stdio`（command/args/env）或 `streamable-http`（url/headers）
- `failOnStartupError: false`：没装 npx 包或没密钥时不要拖垮整个 Web UI
- 模型看见的名字永远是 `mcp__<serverName>__<rawName>`
- 不要在 patch 里写死 token，用 `!!js process.env.X`

## 本仓库怎么加一条

1. 在 `toolkit/catalog.json` 的 `mcp` 数组追加条目
2. `npm run toolkit -- sync`
3. `.env` 里放密钥或 `MCP_*=1`
4. 重启 `npm start`

改 vendor 里的 mcp-client 源码来接业务 MCP：**禁止**。
