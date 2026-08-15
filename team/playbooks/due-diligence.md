# 公开源背调（对齐网易清单，不用海关库）

网易外贸通背调靠的是 **60 亿+ 海关提单 + 2 亿商事库 + 决策人挖掘**。本仓库没有提单库，也不买商业工商包。能做到的是同一张检查表，数据换成 **GitHub/官方公开 API + 网页**。

| 网易维度 | 我们用什么 | 做不到的 |
| --- | --- | --- |
| 企业是否存续 / 地址 / 编号 | `mcp__buyer-dd__company_search`（OpenCorporates；401 时 GLEIF LEI）+ 目标国登记网站 | 付费深度年报、股东穿透付费库 |
| 制裁 / 经营异常 | `mcp__buyer-dd__sanctions_search`（OpenSanctions API，401 时公开 HTML）+ OFAC 公开检索 | 自动排除所有空壳、货代。**未见命中 ≠ 放行** |
| 官网 / 域名 / 社媒 | `web_search` + `mcp__web-search__web_fetch` | 私密联系人库、验证邮箱是否可投 |
| 采购量 / 供应商 / HS | **没有**。写 `customs: none` | 历史提单、货值、采购节奏图 |
| 决策人 | 公开 LinkedIn / 官网 team 页，抄得到才写 | 高置信采购经理电话包 |

## 步骤

1. `report` 【背调专员】已接到。
2. 先 `company_search` 公司英文名 / 本地名。
3. 再 `sanctions_search` 同一名称；有命中就停下来让用户确认身份，不要继续当合格买家开发。
4. `web_search`：`"{name}" importer OR wholesaler`, `"{name}" companies house OR bolagsverket OR handelsregister`, 官网域名。
5. 打开官网公开页：About、Contact、Impressum。邮箱域名要和官网一致。
6. 按 `templates/due-diligence.md` 出报告。未知一律 `TBD`。
7. `report` 【背调专员】完成：路径 + 风险一句话。

## 查询示例

```
web_search query: "Nordic Home" drinkware importer Sweden
mcp__buyer-dd__company_search query: Nordic Home
mcp__buyer-dd__sanctions_search query: Nordic Home
```
