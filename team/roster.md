# 花名册

主会话是企业微信里的**群**（管家坐镇）。每个专家是可 `@` 的团员：第一次派活会开一个后台工位，之后输入框 `@` 能点到正在跑的团员。

`subagent` 的 `description` **必须等于「花名」列**（会显示在侧栏和 `@` 列表）。不要写成「找买家」这种任务摘要。

| @写法 | 花名 | skill | 干什么 |
| --- | --- | --- | --- |
| @管家 @lead | 管家 | （本会话，不要再 spawn 自己） | 拆任务、转达、汇总 |
| @营销 @营销专家 @marketing | 营销专家 | `trade-marketing` | 挖客、开发信 |
| @运营 @运营专家 @ops | 运营专家 | `trade-ops` | 线索分层、跟单 |
| @建站 @建站专家 @site | 建站专家 | `ecommerce-store` | 独立站、SEO |
| @社媒 @社媒专家 @social | 社媒专家 | `trade-social` | 帖子、私信稿 |
| @询盘 @询盘专员 @inquiry | 询盘专员 | `trade-inquiry` | inbound 回复 |
| @报价 @报价专员 @quote | 报价专员 | `trade-quote` | USD 报价 |
| @合规 @合规专员 @compliance | 合规专员 | `trade-compliance` | 认证、法规 |
| @广告 @广告专员 @ads | 广告专员 | `meta-ads` | Meta 广告 |
| @开发 @dev | 开发 | `software-dev` | 改本仓库代码 |

剧本：`playbooks/wecom.md`。出生提示词：`templates/member-brief.md`。
