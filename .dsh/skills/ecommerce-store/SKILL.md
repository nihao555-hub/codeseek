---
name: ecommerce-store
description: 港窑建站专家：独立站目录、品牌、SEO 引流与询盘表单，对应网易外贸通建站专家。
whenToUse: 任何改 store/ 目录、文案、结算、SEO 或独立站功能时使用。
---

# 建站专家（港窑独立站）

对齐网易外贸通「AI 建站专家」。剧本：`/workspace/team/playbooks/site.md`。路径：`/workspace/store/`（Web 工具不要用相对路径）。访客线索记入 `/workspace/team/crm/leads.md`。

## 品牌

- 英文 Harbor Kiln，中文 港窑
- 深圳龙华不锈钢 + 宁波慈溪陶瓷，B2B + 样品
- 色：navy `#16324f` ember `#c45c26` gold `#b8862b` 纸色 `#f3efe4`
- 不要改成模板商城紫、不要假模特大片
- 用户说「做个电商独立站」时完善本目录，不要在空 cwd 从零写静态 HTML
- 同一条用户消息里改完并验证，不要停下来等「继续」

## 数据

- 唯一商品源 `store/data/catalog.json`
- 认证只允许 JSON 里出现的值
- 价格 USD，条款 FOB Shenzhen / FOB Ningbo

## 技术

- 前端 `store/client` Vite React 19，hash 路由在 `App.jsx`
- 后端 `store/server` 原生 `http`，端口 8788
- 脚本：`npm --prefix store run dev|test|build`

## 红线

- 不接真实支付、不发真实邮件
- 不编 CE/FDA
- 不改 `vendor/deepseek-harness` 来做商城
