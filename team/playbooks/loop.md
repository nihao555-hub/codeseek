# 获客 → 成交

对齐网易外贸通：你只要说目标市场和品类，团队自己挖客、出开发信、跟询盘、报价、升商机。销售本人只在高意向时接管。

本仓库**没有**海关库和群发通道。挖客用 GitHub 上的公开检索 / 工商 / 制裁库，线索写入 `team/crm/`（不是自研 Salesforce，完整 CRM 用 [twentyhq/twenty](https://github.com/twentyhq/twenty) 再自建）。

## 一条典型任务

用户：`帮我找北欧买 500ml 保温杯的进口商，有着落就报价。`（可以不写 @）

1. **管家** 立刻 `mcp__trade-open-data__kickoff`，加载 `trade-desk`，派 **营销专家**（不要等人 @，也不要自己搜完就停）。有数量/SKU 再加报价专员。先不要派广告/社媒/建站/合规。
2. **营销** `mcp__trade-crm__search_queries` → 官方 `web_search` → 有公司站再用 `mcp__web-search__web_fetch` → `mcp__trade-crm__upsert_lead`（必须带 sourceUrl）。打开 Impressum/Kontakt 用 `capture_public_email` 保存公示邮箱，没有就留空，不要编。市场体量 `mcp__trade-open-data__comtrade_preview`（国家×HS，不是提单）。展会 `mcp__trade-open-data__list_fairs`。
3. 对 `hot` 线索 `mcp__trade-crm__draft_outreach`。`mail_status` 已配置则 `send_outreach`（触达改 `user-sent`）；否则保持 `draft` 并告诉用户缺 MAIL_FROM。
4. 用户说「对方回了」→ **运营** `mcp__trade-crm__record_reply`（点名公司 + 数量）。触达改成 `replied`。报价文件写 `team/deals/<id>.md`。不要给别的线索出 50pcs 试单顶替。
5. **询盘 / 报价** 用 `mcp__trade-crm__quote_catalog`，数字只来自 `store/data/catalog.json`。报价后 status=`quoted`，档案写 `team/deals/`。
6. **背调** 在升 `quoted` 前跑 `mcp__buyer-dd__*`。制裁未见命中不是放行。
7. 样品 / PI / 订金之后由 **运营** 推 `pipeline` 状态，直到 `shipped`。
8. 用户说每天/每周挖客：`schedule_create`（`every_seconds` 至少 300）。必须是加载定时 overlay 之后**新建**的根会话。

## 不要

- 不要空转等人 @；也不要把广告/社媒/建站/合规全拉出来凑数
- 没有 send_outreach 成功回执时不要说「已发送」
- 不要把本团队当 IDE 去改无关代码
- 不要用社区浏览器插件去登 LinkedIn / 海关付费库
- 不要把 Comtrade 汇总说成提单或进口商名单
- 不要自研搜索引擎或地图爬虫；缺能力先找 GitHub 高星项目再包装 NDJSON
