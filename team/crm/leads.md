# 线索池

对齐网易外贸通「运营专家」：分组、沉睡激活。没有海关库。线索只能来自 `web_search` / 独立站询盘 / 用户提供的名片。

分组：`hot` / `warm` / `nurture` / `sleeping` / `closed`。触达只允许 `draft` / `user-sent` / `replied` / `none`。
没有公开邮箱就留空，不要编。机器写入走 `mcp__trade-crm__*`，本文件由 sync 镜像，不要手改表格。

| 编号 | 公司 | 市场 | 分组 | 来源 | 触达 | 下一步 | 截止日期 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L-2026-001 | Nordic Home Co. | SE | warm | 已有询盘 HK-2026-001 | replied | 等 200 pcs 镭雕与样品地址 | 2026-08-22 |
| L-2026-002 | Demo: EU homeware importers (public web) | EU | nurture | 演示行：用 web_search 替换，勿把本行当真实买家 | none | 用户要挖客时按 playbooks/marketing.md 另起一行 |  |
| L-2026-003 | Kitchenlab AB | SE | nurture | [KitchenLab](https://www.kitchenlab.se/om-oss/) | draft | 邮箱：TBD — 不要编 / 拟写开发信 | 2026-08-22 |

真实邮箱、电话、WhatsApp 写 `team/deals/local/`，不要提交。
