# codeseek · 港窑外贸团队

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的本机 **外贸团队**，对齐 [网易外贸通 AI 团队](https://waimao.163.com/knowledge/article/1462)：管家 + 获客专家 + 成交专家。只做两件事——**找到买家，跟到订单**。不是全能编程 Agent。

闭环：挖客 → 开发信草稿（不代发）→ 询盘 → 报价 → 跟单。没有海关提单库、没有群发 IP。公开网页 + UN Comtrade 汇总 + 开源展会日历 + 本地 `mcp__trade-crm__*` 代替。

- **获客**：营销 / 社媒 / 独立站货架 / 可选 Meta 广告
- **成交**：询盘、报价、运营跟单、公开源背调、合规
- **港窑独立站**：`store/` 里的跨境家居演示站，用来获客不是当 IDE

模型走 GRS 的 OpenAI 兼容中转，默认 `gemini-3.5-flash`，复杂报价可切 `gpt-5.6-sol`。

GRS 目前**不会**返回 OpenAI 原生 `tool_calls`。`scripts/start.sh` 会在本机拉起 `scripts/grs-tool-proxy.mjs`（默认 `http://127.0.0.1:18765/v1`），把工具编进提示词，再把模型输出的 `<tool_call>` 还原成 Harness 能执行的函数调用。

## 需要的环境

- Node.js `>= 22.19`（推荐 22.22+）
- pnpm（Harness 源码安装用）
- `GRS_API_KEY`（必填）
- `META_ACCESS_TOKEN`（可选；没有则不加载 Meta MCP）

源码以 git submodule 放在 `vendor/deepseek-harness`。

```bash
git submodule update --init --depth 1 vendor/deepseek-harness
cp .env.example .env   # 填入 GRS_API_KEY
npm start              # 或 bash scripts/start.sh web
```

浏览器打开 http://127.0.0.1:3080 。新会话请选工作区 **codeseek**。`scripts/start.sh web` 还会在 `0.0.0.0:3081` 起一层反代。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm start` / `scripts/start.sh web` | 启动 Web UI（本机 :3080，公网反代 :3081） |
| `scripts/start.sh headless "任务"` | 无界面跑一条任务 |
| `scripts/start.sh doctor` | 检查 Node、密钥、GRS 连通、工具代理 |
| `npm test` | 单测 |
| `npm run toolkit -- list` | 列出 skill / MCP / 主机工具 |

## 外贸团队

默认人设是港窑 **管家**。一句话即可开干，不必写 @：`帮我找北欧买家买保温杯`。花名册 `team/roster.md`，闭环 `team/playbooks/loop.md`。

- 线索 `team/crm/leads.json`（镜像 `leads.md`）
- 商机 `team/crm/deals.json`（镜像 `pipeline.md`）
- 成交档案 `team/deals/`
- 工具：`mcp__trade-crm__*`、`mcp__trade-open-data__*`、`mcp__buyer-dd__*`、官方 `web_search`、`schedule_*`

定时提醒用官方 `@deepseek-ai/dsh-schedule`（`every_seconds` 最短 5 分钟）。**重启 Web 后必须新建会话**，旧会话没有这组工具。

海关：**没有**提单/进口商名单的合法免费开源库。能用的是联合国 Comtrade 官方 preview（国家 × HS × 年的汇总统计）。展会用 GitHub [LensmorOfficial/trade-show-calendar](https://github.com/LensmorOfficial/trade-show-calendar)。

插件清单参考 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)。社区 Cordis 皮肤/宠物/渗透不装；办公/附件类优先复用本仓库 NDJSON MCP，设置 → 插件 → 工具与 MCP 可看可开。

`subagent` 的 description 必须是花名。产品只以 `store/data/catalog.json` 为准。不发真实邮件，不编造海关数据和邮箱。

外贸能力按 DSH **一切皆插件**：组合包 `plugins/harbor-trade`（官方 schedule + 本仓库 MCP），会话顶栏「港窑实时」`plugins/activity-panel`（和 Chat / Trajectory 一样注册 `conversation.view`，不装 [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) 那套终端工作台）。优先 GitHub 高星 / 官方 API，本仓库只做 NDJSON 包装和 `team/crm/` 落盘。
