---
name: seo-independent-site
description: 跨境独立站 SEO：标题、描述、OG、JSON-LD、可索引路由、别编造评价。
whenToUse: 改独立站首页/PDP 元信息、分享卡片、结构化数据或讨论收录时使用。
---

# 独立站 SEO

这是演示站，hash 路由（`#/p/slug`）对搜索引擎不友好。新增真正收录页时改用 History 路由或服务端渲染；在那之前把能抓的静态壳做好。

## 现在就能做

- `<title>` 与 `meta description` 写清品类 + 产地 + 条款（FOB / 认证），不要「欢迎来到我们的网站」。
- `og:title` / `og:description` 与可见标题一致。
- JSON-LD：`Store` / `Product` 只放 catalog 里有的字段。没有评分来源就不要上 `AggregateRating`。
- 图片 `alt` 用品名，装饰色块可以空 alt。
- 中英切换不要复制两套隐藏全文骗关键词。

## 不要做

- 关键词堆砌、假 5000 条评价、假库存倒计时
- 用客户端才出现的关键正文当唯一内容（爬虫可能看不到）
- 把 `/api/*` 当落地页

## PDP

有真实 URL 后：`Product` + `sku` + `offers.priceCurrency = USD`。认证写在可见正文里，不要只藏在 schema。
