---
name: git-workflow
description: 在本仓库做 git：小步提交、不提交密钥、不改 vendor 脏树、按分支前缀推送。
whenToUse: 提交、推送、看 diff、整理工作区，或用户提到 git 时使用。
---

# Git

- 不要提交：`.env`、`dsh-home/sessions`、`dsh-home/profiles`、`store/node_modules`、`vendor/deepseek-harness` 脏文件
- 提交说明写清做了什么，用中文可以
- Cloud agent 分支名：`cursor/<descriptive-name>-9b96`
- 不要 `git add vendor/deepseek-harness` 除非用户明确要升 submodule pin
- 推送：`git push -u origin <branch>`
- 不要用 `gh` 建 PR；用仓库提供的 PR 工具
