---
name: ecommerce-checkout
description: 报价与结算：购物车行、MOQ、运费门槛、订金条款、查单。
whenToUse: 改购物车、quote、checkout、订单状态或 RFQ 漏斗时使用。
---

# 结算

这是 B2B 演示结算，不是 Stripe 卡支付。

## 报价 `quoteItems`

- 空车 400 `cart_empty`
- 未知 `productId` 400 `unknown_sku`
- `qty` 非正整数 400 `bad_qty`
- `qty > stock` 409 `out_of_stock`
- `qty < moq` 仍允许报价，但 `belowMoq: true`（工厂可能重报价）
- 小计 ≥ 500 USD → `shippingUsd = 0`，否则 48（出口操作费，不是真实运费）

## 下单

- 必须有含 `@` 的邮箱
- 状态从 `awaiting_deposit` 起（T/T 30/70），不要写成 `paid`
- 返回短 id `HK-XXXXXXXX`
- Incoterm 默认行上的 FOB 口岸，允许表单覆盖

## RFQ

- 要 `email` + `message`
- 不在服务端编造单价；销售人工回

## 前端

- 展示 `belowMoq` 警告
- 总额以 API 为准
- 成功后清车并给可复制订单号
