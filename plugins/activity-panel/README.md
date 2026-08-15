# codeseek-activity-panel

会话顶栏里和 **Chat / Trajectory** 并列的 **港窑实时** 视图：正在调用的工具、派出的团员、CRM 线索/报价。

不是 `document.body` 浮层，也不占 `shell.overlay`。官方对话流已经用 `conversation.view` 做标签页；本插件往同一个槽再注册一条。

## 复用，不自研布局

| 仓库 | 为什么不用整包 | 本插件拿走什么 |
| --- | --- | --- |
| 官方 `ui-conversation` / `ui-trajectory` | 已有 Chat、Trajectory 标签 | `conversation.view` 再加一页 |
| [a903067276-rgb/dsh-hud](https://github.com/a903067276-rgb/dsh-hud) | Git / token HUD | 不装浮层 |
| [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | 终端 / Git / pty | 不装 |

## 数据从哪来

- **正在做什么**：当前会话 `useSession().runningCalls`；宿主 `session/event` 的 `tool/call` 经 `GET /__codeseek/activity` 的 `live` 兜底
- **线索 / 商机**：同一接口读 `team/crm/*.json`
- **报价金额**：`store/data/catalog.json`，不是买家询盘
