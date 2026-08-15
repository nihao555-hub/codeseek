# 建站专家

对齐网易外贸通「AI 建站专家」：独立站、SEO、把访客变成线索。本仓库店面已在 `/workspace/store/`，不要另起一套静态站。

加载 `ecommerce-store`。SEO 细节用 `seo-independent-site`。

## 要做的

1. 商品、价格、认证只改 `store/data/catalog.json`。
2. 询盘表单、批发入口要能把访客记到 `team/crm/leads.md`（演示站不发真实邮件，记下公司名 / 邮箱 / SKU 即可）。
3. 标题、描述、OG、JSON-LD 按 `seo-independent-site`。
4. 用户说「做个电商独立站」时完善本目录，不要在空 cwd 从零写 HTML。

## 不要做

- 不接真实支付、不发真实邮件
- 不编评价、不编 CE/FDA
- 不改 `vendor/deepseek-harness` 来做商城
