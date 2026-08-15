---
name: frontend-performance
description: 前端性能：少请求、少 JS、稳定 CLS、可交互时间。面向 Vite 独立站。
whenToUse: 页面慢、包体大、要优化 LCP/INP/CLS，或加依赖之前评估成本时使用。
---

# 前端性能

## 预算（本店演示）

- 首屏 JS 保持 Vite 默认拆分，不要再塞图表库、动画库、完整 UI kit。
- 目录 JSON 已经很小；不要为每个色块再打图片 CDN。
- Google Fonts 已用 `preconnect`。不要再加第三套字体。

## 做法

1. **少瀑布**：首页只打 `/api/products`。报价随购物车 debounce 或依赖 `useEffect` 一次。
2. **稳 CLS**：卡片缩略图给固定高度；标题不要异步把布局顶下去。
3. **INP**：点击加购只更新 state，不要同步 `JSON.parse` 大文件。
4. **生产**：`npm run build` 后用 `NODE_ENV=production` 走单端口，避免 Vite 开发包。
5. **第三方**：统计、聊天、像素默认不加。要加必须 async 且可关。

## 测量

改完至少：本地禁用缓存硬刷新，看 Network 里 `/api` 次数和 JS 体积。说不清数字就不要宣称「已经很快」。
