# 跟单与客户运营

每笔成交一份 `deals/HK-YYYY-NNN-slug.md`。每步只写：当前状态、卡点、负责人、下一步、截止日期。

链路：询盘 → 报价 → 样品 → PI → 订金 → 生产 → 质检 → 出货 → 售后。

改状态时 `mcp__trade-crm__upsert_deal`（会镜像 `pipeline.md`）。不要在会话里只口头说「已跟进」却不写档案。

## 线索运营（网易「运营专家」）

尚未变成商机的公司走 `mcp__trade-crm__list_leads` / `upsert_lead`：

- `hot`：本周必须出稿或跟进
- `sleeping`：超过 30 天无回复，出一封激活信（模板可改写 `templates/outreach.en.md`），状态仍是 `draft`
- 独立站表单进来的访客：先入线索池，有 SKU 和数量再升到 `pipeline.md`

监测只写公开可查的变化（官网改版、招聘、展会），并附 URL。不要假装有海关动态推送。
