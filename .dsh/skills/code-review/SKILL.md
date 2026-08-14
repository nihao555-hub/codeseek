---
name: code-review
description: 审查补丁：正确性、回归、密钥、范围、测试缺口。
whenToUse: 看 diff、给 PR 意见、合并前自检时使用。
---

# 代码审查

按风险说话，不按口味。

## 先问

1. 这段 diff 是否完成用户要的行为？缺了哪条路径？
2. 有没有改 `vendor/deepseek-harness`（默认不应该）？
3. 有没有把 `.env`、session、token 加进提交？
4. API 契约改了前端是否一起改？测试是否红？

## 独立站专项

- 价格只从 catalog / quote 来
- 认证、库存、MOQ 不在 JSX 写死
- 错误码与 `http.test.mjs` 一致
- CSS 没回到紫渐变默认审美

## 意见格式

- 必须改：会错、会泄密、会破坏启动
- 建议：可读性、缺测试
- 赞：好的约束（例如 belowMoq 不拦单）

不要要求无关重构。
