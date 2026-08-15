---
name: testing-and-qa
description: 为改动补测试并做手工验收：Node 测试、Vite build、关键点击路径。
whenToUse: 加功能后、修 bug 后、或用户要求验证独立站 / 代理时使用。
---

# 测试与验收

## 自动

仓库根：

```bash
npm test                 # scripts/lib 工具协议
npm run store:test       # store/server catalog + HTTP
npm run store:build      # Vite 生产包
```

`store/server/http.test.mjs` 会真正 listen 随机端口，覆盖 health / 筛选 / 报价 / 下单 / 查单 / RFQ。

## 新测试原则

- 测业务规则（免运费门槛、MOQ 标记），不要测框架。
- HTTP 测试用 `createHarborServer()`，不要依赖 8788 已被占用。
- 断言错误码字符串，不要只断言 `status !== 200`。

## 手工（`npm run store`）

1. 首页三张 featured，中英切换标题变
2. Shop 筛 FDA + mug
3. PDP 加 MOQ，抽屉出现 belowMoQ 或正常行
4. 结算邮箱校验；成功得到 `HK-`
5. Track 能查到刚下的单
6. Wholesale RFQ 成功提示

没有浏览器就至少跑自动测试 + build，并写明未点过 UI。
