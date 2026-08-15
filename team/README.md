# 港窑外贸团队

这是 Web 会话里的**团队工作台**。调度（主会话）读这里，再按角色出稿或派 subagent。

公司档案：`company.md`  
看板：`pipeline.md`  
产品真相源：`/workspace/store/data/catalog.json`（不要手填价格/认证）

## 角色

| 角色 | skill | 剧本 |
| --- | --- | --- |
| 调度 Trade Lead | `foreign-trade` | 本文件 |
| 询盘 | `trade-inquiry` | `playbooks/inquiry.md` |
| 报价 | `trade-quote` | `playbooks/quote.md` |
| 跟单 | `trade-ops` | `playbooks/ops.md` |
| 合规 | `trade-compliance` | `playbooks/compliance.md` |
| 独立站 | `ecommerce-store` | `/workspace/store/` |
| 广告 | `meta-ads` | `.dsh/skills/meta-ads/SKILL.md` |

## 接到一条客户消息时

1. `read` 本文件、`pipeline.md`、`store/data/catalog.json`。
2. 能对上现有成交就打开 `deals/` 里那份；对不上就按 `templates/deal.md` **新建** `deals/HK-YYYY-NNN-slug.md` 并在看板加一行。
3. 只做当前需要的角色。一封询盘回复不要再派四个 subagent。
4. 给用户两块输出：**可粘贴给客户的稿** + **中文内部备注**（风险、要工厂确认的点、下一步）。
5. 更新看板状态。不要发真实邮件、不要编 catalog 里没有的认证。

## 目录

```
team/
  company.md
  pipeline.md
  playbooks/
  templates/
  deals/           # 单笔成交；真实客户隐私放 deals/local/（已 gitignore）
```
