# codeseek-harbor-trade

DeepSeek Harness **一切皆插件**。本目录是可 `dsh plugin add` 的组合包（`dsh.bundle`），不是改 vendor。

## 复用（GitHub / 官方），不自研

| 环节 | 用谁 | 本仓库 |
| --- | --- | --- |
| 插件内核 / 定时 | `@deepseek-ai/dsh-schedule`、`dsh-time-context`、`dsh-mcp-client` | overlay 插入 |
| 搜索 | [Aas-ee/open-webSearch](https://github.com/Aas-ee/open-webSearch)、DuckDuckGo | NDJSON 包装 |
| 工商 / 制裁 | OpenCorporates、GLEIF、[opensanctions/opensanctions](https://github.com/opensanctions/opensanctions) | `buyer-dd` |
| 市场体量 | 联合国 Comtrade preview；[uncomtrade/comtradeapicall](https://github.com/uncomtrade/comtradeapicall) | `trade-open-data` |
| 展会 | [LensmorOfficial/trade-show-calendar](https://github.com/LensmorOfficial/trade-show-calendar) | `list_fairs` |
| 完整 CRM 产品 | [twentyhq/twenty](https://github.com/twentyhq/twenty) | 本机不拉起 |
| 办公附件 UI | awesome-dsh：`dsh-files` / `dsh-office-tools` | catalog 只展示 |
| 右侧实时面板槽位 | [a903067276-rgb/dsh-hud](https://github.com/a903067276-rgb/dsh-hud) 的 `shell.overlay` | `plugins/activity-panel`。不装 better-sidebar |

不要装：[WangM-A3/silicon-army-mcp](https://github.com/WangM-A3/silicon-army-mcp) 的发信 / 海关 Demo（我们不代发、不编提单）。MCP 设置页已有本仓库 `codeseek-toolkit-panel`，不必再装 `hyqhyq3/dsh-mcp-manager`。

## 本仓库自己写的（没有现成轮子才写）

- `scripts/trade-crm-mcp.mjs`：线索 / 商机 / **catalog 报价** / 开发信草稿 / `record_reply`
- `scripts/trade-open-data-mcp.mjs`：kickoff + Comtrade preview + 展会日历包装
- 人设与花名册：`.dsh/skills/trade-*`、`team/playbooks/`

报价金额只来自 `store/data/catalog.json`，不是买家官网价格，也不是海关货值。
