---
name: i18n-storefront
description: 中英双语店面：字典键、lang 属性、商品字段 loc、询盘语言。
whenToUse: 加文案、翻译、语言切换，或商品 name/tagline/specs 双语字段时使用。
---

# 双语店面

- UI 字符串放 `store/client/src/i18n.js` 的 `dict.en` / `dict.zh`，用 `t(lang, key)`。
- 商品内容放 catalog 的 `{ en, zh }`，用 `loc(item, lang)`。不要在 JSX 里写死中文或英文长句。
- 切换语言：按钮改 `lang` state，并设置 `document.documentElement.lang` 为 `en` 或 `zh-CN`。
- RFQ 把 `lang` 传给后端，方便以后按买家语言回复；当前服务只存储不翻译。
- 数字、货币、SKU、认证缩写保持原样（USD、CE、FDA、MOQ）。
- 缺译时回退英文，不要显示 key 名给买家。
- 新键必须中英成对添加。
