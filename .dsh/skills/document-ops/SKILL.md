---
name: document-ops
description: 处理询盘 PDF、报价表、合同草稿：提取、对照 catalog、不编造认证。
whenToUse: 用户丢来 PDF/DOCX/XLSX，或要出报价表、箱单、PI 时使用。
---

# 文档

本仓库**没有**把 Anthropic 的 docx/pdf/pptx/xlsx skill 默认装进来（那些是 source-available 非开源）。需要时用系统工具：

- PDF：`pdftotext`（若已安装）或说明缺口
- 表格：Node 读 CSV/JSON；xlsx 先确认是否允许加依赖
- 对外英文、对内中文备注，走 `foreign-trade`

数字必须能对上 `store/data/catalog.json` 或用户提供的文件。没有的认证写成 TBD。
