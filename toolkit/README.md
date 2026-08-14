# 工具箱装配

把 DeepSeek Harness 用到的 **skill / MCP / 主机工具** 收成一份目录，按需打开。默认不连一堆 MCP（没密钥会拖慢启动、污染工具列表）。**本地联网搜索 `web-search` 默认打开**：先查开源 [SearXNG](https://github.com/searxng/searxng)，公开实例失败再解析 DuckDuckGo HTML。Web overlay 关掉了原生 `tool-web`。

## 一分钟

```bash
npm run toolkit -- list              # 看目录
npm run toolkit -- enable github sequential-thinking
npm run toolkit -- fetch-skills      # 拉取 catalog 里允许的远程 SKILL.md
npm run toolkit -- doctor
npm start                            # start.sh 会 sync 并 --patch MCP 层
```

强制打开写在 `toolkit/enabled.json`（当前默认包含 `web-search`）。有密钥的服务（`GITHUB_TOKEN`、`META_ACCESS_TOKEN` 等）会自动打开。无密钥服务用 `MCP_PLAYWRIGHT=1` 这类开关。自建 SearXNG 把 `.env` 的 `SEARXNG_URL` 换成你的实例，并可 `npm run toolkit -- enable searxng`。

生成文件：`dsh-home/cordis.mcp.patch.yml`（不要手改）。许可证：`toolkit/NOTICE.md`。
