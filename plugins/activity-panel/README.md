# codeseek-activity-panel

Web **右侧实时面板**：当前会话在跑什么工具、派了哪些团员、CRM 刚写下的线索/报价。

## 复用，不自研布局

GitHub 上已经有右侧栏轮子，对照后没有原样安装：

| 仓库 | 为什么不用整包 | 本插件拿走什么 |
| --- | --- | --- |
| [a903067276-rgb/dsh-hud](https://github.com/a903067276-rgb/dsh-hud) | Git / token HUD，不是外贸活动 | 官方 `shell.overlay` + `conversation.input.left` |
| [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | 终端 / Git / node-pty 工作台，过重 | 不装 |
| [vlln/dsh-task-status](https://github.com/vlln/dsh-task-status) | 只覆盖后台 bash 任务条 | 会话 `runningCalls` 已覆盖工具中 |

官方对话流里已有 `ui-workflow-run`（子代理折叠卡）和点选后的 `details` 列。本面板是**常驻右侧**，默认打开。

## 数据从哪来

- **正在做什么**：浏览器会话快照 `running` / `runningCalls` / 子代理列表（零 RPC）
- **线索 / 商机**：`GET /__codeseek/activity` 读 `team/crm/*.json`
- **报价金额**：`store/data/catalog.json`，不是买家询盘
