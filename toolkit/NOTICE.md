# 第三方技能与 MCP 声明

本目录的 `catalog.json` 收录可装配来源，**不等于**把上游全文拷进本仓库。

## Skills

- 仓库自有 skill（`.dsh/skills/` 里无 `source` 字段或 `source.kind = local`）为 codeseek 原创。
- 通过 `npm run toolkit fetch-skills` 拉取的远程 skill 保留上游 frontmatter 的 `license` 字段。
- [anthropics/skills](https://github.com/anthropics/skills) 中多数示例为 Apache-2.0；`docx` / `pdf` / `pptx` / `xlsx` 为 **source-available、非开源**，本装配器默认不拉取这四份。
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) 只作索引（MIT 列表），不批量拷贝其中第三方正文。

## MCP

- 官方注册表：https://registry.modelcontextprotocol.io
- 参考服务器：https://github.com/modelcontextprotocol/servers
- GitHub 官方 MCP：https://github.com/github/github-mcp-server
- Playwright：https://github.com/microsoft/playwright-mcp
- Stripe / Linear / Notion 等远程 MCP 需要各自账户与密钥，密钥只放 `.env`。

不要把 token 写进 `catalog.json`、patch 或 commit。
