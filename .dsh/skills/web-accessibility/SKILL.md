---
name: web-accessibility
description: 按 WCAG 2.2 改 UI：键盘、焦点、语义、对比度、动态内容通知。
whenToUse: 做表单、弹层、导航、独立站结算，或用户提到无障碍 / a11y / 键盘操作时使用。
---

# 无障碍

目标：键盘能买完一杯样品，读屏能听见价格和错误。

## 必做

- 每个页面一个 `h1`。导航用 `<nav>`，主内容 `main`，购物车抽屉 `role="dialog"` + `aria-modal`。
- 提供「跳到主内容」链接，聚焦时可见。
- 按钮是 `<button>`，链接是 `<a href>`。不要 `div onClick`。
- 表单控件有可见 `<label>` 或 `aria-label`。错误用 `role="alert"`。
- 语言切换时改 `document.documentElement.lang`。
- 对比度：正文与纸色 ≥ 4.5:1。港窑 Navy 上白字可以，浅金上浅纸不行。
- `prefers-reduced-motion: reduce` 时关掉过渡。
- 焦点可见，不要 `outline: none` 后不给替代。

## 抽屉与对话框

- 打开时焦点进入；关闭时回原按钮。
- Esc 关闭（若还没做，补上）。
- 背景滚动锁可选；至少不要让焦点落到遮罩后面还不声明 modal。

## 验收

Tab 走完导航 → 加购 → 结算字段 → 提交。不要出现「焦点消失」。
