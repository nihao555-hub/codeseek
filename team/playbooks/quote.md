# 报价

- 先 `mcp__trade-crm__quote_catalog`（数字只来自 `store/data/catalog.json`）。需要再 `read` 目录核对认证。
- 客户稿只给：单价 USD、MOQ、交期、条款、包装、付款、样品、有效期（默认 14 天）。
- 内部备注才拆：出厂、物流粗估、利润空间。底价不进客户稿。
- 给 2 档：主推（现货色、白盒）与升级（礼盒 / Logo）。说明取舍。
- 数量低于 MOQ 时写清加价或劝升到 MOQ，不要装作可以破价。
- 报价后 `mcp__trade-crm__upsert_deal` status=`quoted`，档案仍可按 `templates/quotation.md` 落到 `deals/`。
