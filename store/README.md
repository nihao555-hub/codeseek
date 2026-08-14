# Harbor Kiln · 港窑独立站

跨境家居演示独立站：深圳不锈钢真空杯 + 宁波窑陶瓷。前台 Vite + React 19，后台 Node 原生 HTTP。购物车、MOQ 警告、满 $500 免出口操作费、T/T 订金结算、批发询盘、订单查询。

## 启动

```bash
cd store
npm install
npm test          # 目录报价 + HTTP 往返
npm run dev       # API :8788 + Vite :5173（/api 反代）
```

生产构建后只开 API 端口即可托管静态资源：

```bash
npm run build
NODE_ENV=production npm start   # http://127.0.0.1:8788
```

仓库根也可以：`npm run store` / `npm run store:test` / `npm run store:build`。

## 约定

- 目录真相源：`data/catalog.json`。价格、MOQ、认证不要在前端写死。
- 结算是演示：内存订单，进程重启即丢失；不接真实支付。
- 认证只展示 catalog 里已有的 CE / FDA / LFGB，禁止编造。
- 品牌色：navy `#16324f`、ember `#c45c26`、gold `#b8862b`，不要换成紫渐变 + Inter。
