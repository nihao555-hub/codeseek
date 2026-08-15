# 项目 Skills

放在 `.dsh/skills/<name>/SKILL.md`。名字必须 kebab-case。模型用 `skill` 工具加载。启动时会把本目录链到 `dsh-home/skills`，这样 Web 会话工作区不是仓库根时也能加载。skill 报 unknown 时跳过，不要空转。

## 业务

| Skill | 何时用 |
| --- | --- |
| `foreign-trade` | 管家：按网易外贸通 1+N 分派专家 |
| `trade-marketing` | 挖客 + 开发信（不代发） |
| `trade-inquiry` | 客户询盘回复 |
| `trade-quote` | USD 报价 / MOQ / 交期 |
| `trade-ops` | 线索运营 + 样品到出货 |
| `trade-social` | 社媒帖 / 私信稿 |
| `trade-compliance` | 认证与出口规则 |
| `meta-ads` | Facebook / Instagram 广告 |
| `ecommerce-store` | 建站专家：港窑独立站 |

## 前端（高星实践浓缩）

| Skill | 灵感来源 |
| --- | --- |
| `frontend-design` | Anthropic `frontend-design`（避免 AI 默认审美） |
| `react-best-practices` | Vercel React / Next 性能与组件实践 |
| `react-storefront` | 独立站店面：目录、PDP、购物车 |
| `web-accessibility` | WCAG 2.2 |
| `frontend-performance` | Core Web Vitals |
| `seo-independent-site` | 独立站 SEO / OG / JSON-LD |
| `i18n-storefront` | 中英双语店面 |
| `copywriting-conversion` | 跨境独立站文案 |

## 后端与工程

| Skill | 何时用 |
| --- | --- |
| `software-dev` | 本仓库开发流程 |
| `api-design` | REST 契约、错误码 |
| `backend-reliability` | 超时、重试、幂等 |
| `ecommerce-checkout` | 报价、MOQ、结算 |
| `auth-and-secrets` | 密钥与鉴权 |
| `testing-and-qa` | 单测与验收 |
| `code-review` | 审查清单 |
| `systematic-debugging` | 先证据后改代码 |

| `assemble-toolkit` | 查看/启用/拉取 skill 与 MCP |
| `mcp-integration` | 往 catalog 加 MCP |
| `skill-creator` | 新建本地 SKILL.md |
| `git-workflow` / `github-ops` | git 与 GitHub |
| `browser-qa` / `web-research` / `document-ops` | 浏览器、调研、文档 |

远程 skill（Apache 示例）用 `npm run toolkit -- fetch-skills` 拉取，见 `toolkit/catalog.json`。完整 MCP 列表同样在该文件。不要提交密钥。

改独立站时代码在 `/workspace/store/`。
