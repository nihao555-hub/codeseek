---
name: auth-and-secrets
description: 密钥与鉴权：.env、gitignore、日志脱敏、演示站不要假装已登录。
whenToUse: 涉及 GRS/Meta token、用户邮箱、准备上线鉴权或审查泄漏时使用。
---

# 密钥与鉴权

## 本仓库

- `GRS_API_KEY`、`META_ACCESS_TOKEN` 只在 gitignored `.env`
- 不要回显、不要写进 SKILL、README、commit、会话标题
- `dsh-home/settings.yaml` 的 `baseURL` 指向本地工具代理，不要把上游 URL 和代理绕成环

## 独立站

- 当前**没有**买家账户。不要加假登录墙。
- 订单号即查询密钥（演示）。真上线要邮箱校验或签名 token。
- CORS `*` 只适合本机演示。
- 日志禁止打印完整邮箱以外的 PII；能打 `orderId` 就够。

## 新鉴权（若用户要求）

先 session cookie + 服务端 secret，再 OAuth。密钥旋转写在 `.env.example` 占位符，不写真实值。
