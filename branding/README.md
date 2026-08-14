# 品牌资源

codeseek 超级员工的视觉资产。运行 `scripts/apply-brand.sh` 会覆盖进 `vendor/deepseek-harness` 的 Web 前端（不提交 submodule 改动）。

## 生成图

| 文件 | 用途 |
| --- | --- |
| `generated/codeseek-app-icon.png` | 应用图标 / 启动页 |
| `generated/codeseek-wordmark.png` | 横版字标 |
| `generated/codeseek-hero-glow.png` | 备用素材，空会话不再铺这张底图 |
| `generated/codeseek-empty-state.png` | 空状态插画 |
| `generated/codeseek-sidebar-ornament.png` | 侧栏装饰 |

## SVG

`svg/mark.svg`、`svg/wordmark.svg`、`svg/favicon.svg` 用于小尺寸界面，描边跟随 `currentColor`，罗盘星为金色 `#F5C16C`。

模型选择栏使用官方 Gemini（2025 彩虹星标）和 OpenAI 花瓣标，放在 `svg/model-gemini.svg` / `svg/model-openai.svg`，启动时由 `apply-brand.sh` 拷到 `/brand/models/`。
