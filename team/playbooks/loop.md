# 获客 → 成交

对齐网易外贸通：你只要说目标市场和品类，团队自己挖客、出开发信、跟询盘、报价、升商机。销售本人只在高意向时接管。

本仓库**没有**海关库和群发通道。公开网页 + 本地 CRM 代替。

## 一条典型任务

用户：`帮我找北欧买 500ml 保温杯的进口商，有着落就报价。`

1. **管家** 加载 `trade-desk`，`@营销专家`（不要自己搜完就停）。
2. **营销** `mcp__trade-crm__search_queries` → 官方 `web_search` → 有公司站再用 `mcp__web-search__web_fetch` → `mcp__trade-crm__upsert_lead`（必须带 sourceUrl）。没公开邮箱就空着。
3. 对 `hot` 线索 `mcp__trade-crm__draft_outreach`，触达保持 `draft`。把英文稿 `report` 给群，让用户自己发出去。
4. 用户说「已发出 / 对方回了」→ **运营** 把 touch 改成 `user-sent` / `replied`。有数量和 SKU → `upsert_deal` status=`new`。
5. **询盘 / 报价** 用 `mcp__trade-crm__quote_catalog`，数字只来自 `store/data/catalog.json`。报价后 status=`quoted`，档案写 `team/deals/`。
6. **背调** 在升 `quoted` 前跑 `mcp__buyer-dd__*`。制裁未见命中不是放行。
7. 样品 / PI / 订金之后由 **运营** 推 `pipeline` 状态，直到 `shipped`。

## 不要

- 不要一次拉齐全部工位
- 不要说「已发送」
- 不要把本团队当 IDE 去改无关代码
- 不要用社区浏览器插件去登 LinkedIn / 海关付费库
