---
name: react-storefront
description: 电商店面信息架构：首页、目录筛选、PDP、购物车抽屉、结算、询盘、查单。
whenToUse: 改 Harbor Kiln 或任何 B2B+DTC 店面的页面流、筛选、加购与批发入口时使用。
---

# 店面结构

港窑同时卖样品和柜货。零售加购与批发询盘必须同时存在，不要做成纯 TOC 商城。

## 页面

| 路由 | 职责 |
| --- | --- |
| `#/` | 主张 + 3 个 featured |
| `#/shop` | 搜索、类目、认证、排序 |
| `#/p/:slug` | 规格、MOQ、交期、认证、加购 |
| `#/checkout` | 联系人、公司、国家、Incoterm |
| `#/wholesale` | 自由文本 RFQ |
| `#/track` `#/order/:id` | 查单 |
| `#/about` | 产地故事，不写空话使命 |

## 规则

- 目录筛选状态可以暂时放 React state；要可分享时再写入 hash query。
- 加购默认可以 ×1（样品）和 ×MOQ（柜货）。低于 MOQ 必须在报价里标红，不要静默改价。
- 购物车是草稿：`localStorage` 键 `hk-cart-v1`。下单成功后清空。
- 价格永远来自 API 报价，不要只在前端累加后当真。
- 缺货 / 未知 SKU 显示错误，不要生成「相似商品」假数据。
