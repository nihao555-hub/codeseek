# 港窑外贸团队

对齐 [网易外贸通 AI 团队](https://waimao.163.com/knowledge/article/1462) 的 **1 个管家 + 四大专家**，交互对齐企业微信：在群里 `@花名` 指派，团员后台执行，用 `report` 往群里汇报进度和报错。

主会话是群，管家坐镇。花名册：`roster.md`。工位剧本：`playbooks/wecom.md`。先读这两份，再读 `company.md`、`crm/leads.md`、`pipeline.md`。产品只信 `/workspace/store/data/catalog.json`。

## 闭环（抄他们的流程，不抄他们没有的数据）

网易外贸通：找客 → 触达 → 管理 → 建站引流 → 转化。

本仓库同样跑这条链，但**没有** 60 亿海关库、高信誉发信 IP、自动邮件 / WhatsApp。替代方式：

| 网易能力 | 我们怎么做 |
| --- | --- |
| 海关 / 社媒 / Google 挖客 | `web_search` + `mcp__web-search__web_fetch`，来源写进线索表 |
| 开发信多轮触达 | 只出可粘贴稿，**不代发** |
| 高潜分组 / 沉睡激活 | `team/crm/leads.md` |
| 独立站 + SEO + 访客线索 | `store/` + `ecommerce-store` |
| 多平台内容 / 私信 | 只出帖子和私信稿，不登录对方后台 |

禁止编造邮箱、海关提单、认证和“已发送”状态。

## 角色

| 网易角色 | 本仓库 | skill | 台账 / 剧本 |
| --- | --- | --- | --- |
| 管家 | Trade Lead | `foreign-trade` | 本文件 |
| AI 营销专家 | 挖客 + 开发信 | `trade-marketing` | `crm/leads.md`、`playbooks/marketing.md` |
| AI 运营专家 | CRM + 跟单 | `trade-ops` | `crm/leads.md`、`pipeline.md`、`playbooks/ops.md` |
| AI 建站专家 | 港窑独立站 | `ecommerce-store` | `store/`、`playbooks/site.md` |
| AI 社媒专家 | 内容 / 私信稿 | `trade-social` | `playbooks/social.md` |
| （港窑加项）询盘 |  inbound 回复 | `trade-inquiry` | `playbooks/inquiry.md` |
| （港窑加项）报价 | FOB / MOQ | `trade-quote` | `playbooks/quote.md` |
| （港窑加项）合规 | 认证 / 出口 | `trade-compliance` | `playbooks/compliance.md` |
| 广告 | Meta | `meta-ads` | 广告 skill |

## 群里怎么用

在输入框写 `@营销专家 找一批北欧保温杯进口商`。管家会开（或叫醒）叫「营销专家」的后台工位。团员用 `【营销专家】进行中：…` 往群里报。侧栏会话标题里的子代理树可以点进该工位单聊。第一次派活之后，输入框 `@` 会列出正在跑的团员。

不要一次拉齐全部空闲工位。已有同花名团员用 `send_message`，不要重复开人。

## 接到一条用户消息时

1. `read` 本文件、`roster.md`、`playbooks/wecom.md`。需要报价或产品事实时再读 catalog。
2. 有 `@花名` 或专家活 → 按工位剧本派人，不要替被 @ 的人干活。
3. 团员把结果写进 `crm/leads.md` / `pipeline.md` / `deals/`，并 `report` 到群。
4. 管家给用户的话要短，像群公告；详细稿在团员汇报或台账里。
5. 不要发真实邮件，不要编 catalog 里没有的认证。

## 目录

```
team/
  roster.md        # @花名
  company.md
  crm/leads.md     # 线索池（营销 + 运营）
  pipeline.md      # 已进入询盘/报价的商机
  playbooks/       # 含 wecom.md 工位
  templates/       # 含 member-brief.md 出生信
  deals/           # 单笔成交；真实客户隐私放 deals/local/
```
