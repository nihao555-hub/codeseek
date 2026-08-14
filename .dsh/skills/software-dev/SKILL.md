---
name: software-dev
description: 在当前工作区做开发任务：读代码、小步修改、运行检查、给出可审查补丁。
whenToUse: 实现功能、修 bug、写脚本、改配置、排查构建或补测试时使用。
---

# 开发执行

你在 DeepSeek Harness 里改这个仓库。默认 `gemini-3.5-flash`；架构设计、棘手 bug、大范围重构改用 `gpt-5.6-sol`。

独立站在 `/workspace/store/`。改店面时加载 `ecommerce-store`，并按任务再加载 `frontend-design` / `react-best-practices` / `api-design` / `ecommerce-checkout` 等。完整清单见 `.dsh/skills/README.md`。

长任务（建站、修功能、补测试）必须在同一条用户消息里连续 read → write/edit → bash 验证，直到可交付。不要只列完目录就停下来让用户回复「继续」。

## 流程

1. 先定位相关文件和现有模式，再改。
2. 最小可工作改动。不顺手重构，不添加未要求的依赖。
3. 改完运行已有检查（lint / test / doctor）。没有测试时，说明如何手工验证。
4. 密钥只走环境变量和 `.env`（已 gitignore）。不要把 token 写进源码、日志或提交说明。

## 本仓库约定

- DeepSeek Harness 源码在 `vendor/deepseek-harness`（git submodule）。不要为了业务需求去改它，除非在修上游集成问题。
- 超级员工配置在 `dsh-home/`（`settings.yaml`、`cordis.patch.yml`）和 `.dsh/skills/`。
- 演示独立站在 `store/`（Vite React + Node HTTP，端口 5173 / 8788）。不要为了商城去改 vendor。
- 品牌资源在 `branding/`，用 `scripts/apply-brand.sh` 覆盖进 Web 前端。
- 启动入口是 `scripts/start.sh`。`DSH_HOME` 指向 `dsh-home/`。
- 模型提供方 id 是 `grsai`，走 OpenAI 兼容接口。

## 输出

- 改了什么、为什么
- 怎么验证
- 已知风险
