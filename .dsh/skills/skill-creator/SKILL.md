---
name: skill-creator
description: 为本仓库新建或修改 DeepSeek Harness skill：kebab-case、frontmatter、何时加载。
whenToUse: 用户要新 skill、改 SKILL.md、或 skill 工具加载失败时使用。
---

# 写 Skill

路径：`.dsh/skills/<name>/SKILL.md`

```yaml
---
name: my-skill
description: 一句话，出现在模型的 skill 目录里。
whenToUse: 什么任务必须加载。
---
```

## 约束

- `name` 必须 kebab-case，且与目录名一致
- `description` + `whenToUse` 都要有（本仓库单测会查）
- 写可执行步骤，不要空话
- 不要整份拷贝许可证不明的上游 SKILL.md；远程拉取走 `assemble-toolkit fetch-skills`
- 改完跑 `npm test`（含 `scripts/lib/skills-catalog.test.mjs`）
