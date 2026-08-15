---
name: systematic-debugging
description: 系统化排障：先复现和证据，再改代码。避免盲目重写。
whenToUse: 构建失败、API 4xx/5xx、白屏、工具调用失败、代理/Harness 异常时使用。
---

# 系统化排障

1. **复现**：命令、URL、请求体、期望 vs 实际。只发生一次的先记日志。
2. **定位层**：浏览器 → Vite 代理 → `store/server` → `catalog.mjs`；或 Web UI → 工具代理 → GRS。
3. **最小证据**：`curl` / `npm test` / 浏览器 Network。不要先重构。
4. **一次一个假设**：例如「quote 用了 `id` 而不是 `productId`」。
5. **修完回归**：相关测试 + 刚才失败的那条手工路径。

## 本仓库常见坑

- Web 会话 cwd 可能是 `/`：读写用 `/workspace/...` 绝对路径
- 改了 `grs-tool-proxy.mjs` 必须杀掉旧进程再拉起（`ensure_tool_proxy` 只看 /health）
- `pkill -f grs-tool-proxy.mjs` 不要和当前 shell 写在同一条会自伤的命令里
- GRS 不返回原生 `tool_calls`，走文本协议；JSON 里的原始换行要靠 proxy 修复
- 独立站开发时 Vite :5173，API :8788；只开 API 没有 dist 会 503

没有证据不要把锅推给「模型不行」。
