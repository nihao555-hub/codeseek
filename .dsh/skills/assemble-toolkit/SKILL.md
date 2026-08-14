---
name: assemble-toolkit
description: 装配本仓库的 skill、MCP 与主机工具：查看目录、启用/关闭、拉取远程 skill、生成 cordis MCP patch。
whenToUse: 用户要加 MCP、装新 skill、查看当前工具箱、或说「装配自己的工具」时使用。
---

# 装配工具箱

目录在 `toolkit/catalog.json`。不要手改生成文件 `dsh-home/cordis.mcp.patch.yml`。

## 命令

```bash
npm run toolkit -- list
npm run toolkit -- enable github playwright sequential-thinking
npm run toolkit -- disable playwright
npm run toolkit -- sync
npm run toolkit -- fetch-skills
npm run toolkit -- refresh-mcp
npm run toolkit -- doctor
```

`start.sh web|headless` 会先 `sync`，再 `--patch` 生成的 MCP 层。

## 打开 MCP 的三种办法（任一即可）

1. 把 id 写入 `toolkit/enabled.json` 的 `mcp` 数组，然后 sync
2. 环境变量 `MCP_<FLAG>=1`（见 catalog 里每条的 `enableWhen.flag`）
3. 填上对应密钥（例如 `GITHUB_TOKEN`、`META_ACCESS_TOKEN`）——有密钥会自动打开

密钥只放 gitignored `.env`。工具名：`mcp__<serverName>__<rawName>`。

## 远程 skill

`fetch-skills` 只拉 catalog 里 `kind: remote` 且许可证允许的 `SKILL.md`。Anthropic 的 docx/pdf/pptx/xlsx **默认不拉**（非开源）。

新本地 skill：kebab-case 目录 + `SKILL.md` frontmatter 必须有 `name`、`description`、`whenToUse`。
