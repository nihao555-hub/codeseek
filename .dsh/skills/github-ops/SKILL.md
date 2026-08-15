---
name: github-ops
description: 用 GitHub MCP 或 gh 只读查看 Issue/PR/CI；写操作前确认。
whenToUse: 查 GitHub 仓库、PR、Action 日志，或装配了 github MCP 之后使用。
---

# GitHub

优先顺序：

1. 已加载 `mcp__github__*` 或 `mcp__github-official__*` 时走 MCP
2. 否则 `gh` 只读（`gh pr view`、`gh run list`）
3. 再否则说明缺口（没有 `GITHUB_TOKEN`）

## 密钥

`.env`：`GITHUB_TOKEN` 或 `GITHUB_PERSONAL_ACCESS_TOKEN`。装配：`npm run toolkit -- enable github`

## 红线

- 不要把 token 打进日志
- 不要擅自给仓库加 webhook、改权限、强推 main
- 本环境的 `gh` 可能是只读；创建 PR 用专门工具
