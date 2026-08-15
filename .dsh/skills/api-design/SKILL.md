---
name: api-design
description: 设计与修改 HTTP JSON API：资源命名、错误码、校验、兼容。
whenToUse: 加或改 /api 路由、请求体、状态码，或前后端契约对不齐时使用。
---

# API 设计

港窑 API 在 `store/server/index.mjs`，目录逻辑在 `catalog.mjs`。保持原生 HTTP + JSON，不要无故上 Express。

## 现在的契约

| 方法 | 路径 | 成功 |
| --- | --- | --- |
| GET | `/api/health` | 200 `{ ok, products }` |
| GET | `/api/collections` | 200 |
| GET | `/api/products` | 200 筛选 `q,category,cert,sort` |
| GET | `/api/products/:slug` | 200 / 404 |
| POST | `/api/quote` | 200 报价 |
| POST | `/api/checkout` | 201 `{ order }` |
| GET | `/api/orders/:id` | 200 / 404 |
| POST | `/api/rfq` | 201 `{ id, status }` |

## 规则

- 错误体统一 `{ error: snake_case }`，用 400 校验、404 没有、409 冲突（超库存）、500 意外。
- POST 读 JSON 失败 → 400 `invalid_json`，不要 500。
- 筛选用 query；写操作用 POST。不要 GET 下单。
- 字段名稳定：`productId`、`priceUsd`、`moq`。不要同一含义中英混用。
- 改契约先改 `store/server/*.test.mjs` 再改客户端 `api.js`。
- CORS 演示站可以 `*`；真上线收紧 Origin。
