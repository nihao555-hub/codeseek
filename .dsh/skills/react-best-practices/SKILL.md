---
name: react-best-practices
description: React 组件与数据获取实践：减少瀑布请求、控制重渲染、状态放对位置。
whenToUse: 写或改 React 组件、hooks、列表、表单、客户端数据获取时使用。浓缩自 Vercel React / Next 工程实践。
---

# React 实践

本仓库店面是 Vite SPA（`store/client`），没有 RSC。把「服务端能做的」放到 `store/server`，客户端只渲染与交互。

## 数据

- 不要在父组件 fetch 完再让每个卡片再 fetch。一次 `/api/products` 喂整个网格。
- PDP 用 slug 拉详情；离开页面要取消或忽略过期响应（`cancelled` 标志）。
- 派生数据用 `useMemo` 只在确有昂贵计算时；购物车数量直接 `reduce`。
- 能从 props 算出的不要再 `useState` 同步。

## 渲染

- 列表必须稳定 `key`（`product.id` / `sku`），不要用数组下标当长期 key。
- 事件处理函数保持纯：`add(product, qty)` 不要闭包过期 cart。
- 大列表才考虑虚拟化；6–30 个 SKU 用 CSS grid 即可。
- `StrictMode` 双调用是正常的，副作用必须可重复。

## 包体

- 不要为了路由再加 React Router，除非 hash 路由已经明显失控。
- 不要引入 UI 框架只为了一个 Button。
- 图片有真实 URL 再 `loading="lazy"`；CSS 色块占位可以没有网络图。

## 状态分层

| 放哪 | 例子 |
| --- | --- |
| 服务端 / API | 库存、报价、订单 |
| URL hash | 当前页、筛选 |
| localStorage | 购物车草稿 |
| React state | 抽屉开关、表单、notice |
