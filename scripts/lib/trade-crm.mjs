/**
 * 港窑外贸 CRM：线索 → 商机 → 报价。本地 JSON，镜像成 Markdown。
 * 对齐网易外贸通「线索到订单」，没有海关库、不代发邮件。
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const GROUPS = ['hot', 'warm', 'nurture', 'sleeping', 'closed']
export const TOUCH = ['none', 'draft', 'user-sent', 'replied']
export const DEAL_STATUS = [
  'new', 'quoted', 'sample', 'pi', 'deposit', 'production', 'qc', 'shipped', 'after-sales', 'lost', 'on-hold',
]

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

export function workspaceRoot() {
  return process.env.DSH_WORKSPACE || REPO_ROOT
}

export function crmPaths(root = workspaceRoot()) {
  return {
    root,
    leadsJson: join(root, 'team/crm/leads.json'),
    dealsJson: join(root, 'team/crm/deals.json'),
    leadsMd: join(root, 'team/crm/leads.md'),
    pipelineMd: join(root, 'team/pipeline.md'),
    catalog: join(root, 'store/data/catalog.json'),
    outreachTpl: join(root, 'team/templates/outreach.en.md'),
    quoteTpl: join(root, 'team/templates/quotation.md'),
  }
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

export function loadCatalog(root = workspaceRoot()) {
  const path = crmPaths(root).catalog
  if (!existsSync(path)) return []
  const rows = JSON.parse(readFileSync(path, 'utf8'))
  return Array.isArray(rows) ? rows : []
}

export function loadCrm(root = workspaceRoot()) {
  const paths = crmPaths(root)
  const leadsFile = readJson(paths.leadsJson, { leads: [] })
  const dealsFile = readJson(paths.dealsJson, { deals: [] })
  return {
    leads: Array.isArray(leadsFile.leads) ? leadsFile.leads : [],
    deals: Array.isArray(dealsFile.deals) ? dealsFile.deals : [],
  }
}

function nextId(prefix, rows) {
  const year = new Date().getUTCFullYear()
  const used = new Set(rows.map((row) => row.id))
  let n = 1
  while (used.has(`${prefix}-${year}-${String(n).padStart(3, '0')}`)) n += 1
  return `${prefix}-${year}-${String(n).padStart(3, '0')}`
}

function clip(text, n = 400) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, n)
}

function pick(value, allowed, fallback) {
  const text = String(value || '').trim()
  return allowed.includes(text) ? text : fallback
}

export function upsertLead(input, root = workspaceRoot()) {
  const crm = loadCrm(root)
  const company = clip(input.company, 120)
  if (!company) throw new Error('company is required')
  const sourceUrl = String(input.sourceUrl || input.source_url || '').trim()
  let row = crm.leads.find((item) => item.id === input.id)
    || crm.leads.find((item) => item.company.toLowerCase() === company.toLowerCase() && item.market === String(input.market || item.market || '').trim())
  if (!row) {
    row = { id: input.id || nextId('L', crm.leads) }
    crm.leads.push(row)
  }
  Object.assign(row, {
    id: row.id,
    company,
    market: clip(input.market || row.market, 40) || 'TBD',
    group: pick(input.group, GROUPS, row.group || 'nurture'),
    source: clip(input.source || row.source, 200) || (sourceUrl || 'user'),
    sourceUrl: sourceUrl || row.sourceUrl || '',
    touch: pick(input.touch, TOUCH, row.touch || 'none'),
    next: clip(input.next || row.next, 200),
    due: clip(input.due || row.due, 20),
    email: clip(input.email || row.email, 120),
    notes: clip(input.notes || row.notes, 400),
    sku: clip(input.sku || row.sku, 40),
    updatedAt: new Date().toISOString(),
  })
  if (row.touch === 'none' && !row.email) row.email = row.email || ''
  saveCrm(crm, root)
  return row
}

export function upsertDeal(input, root = workspaceRoot()) {
  const crm = loadCrm(root)
  const buyer = clip(input.buyer || input.company, 120)
  if (!buyer) throw new Error('buyer is required')
  let row = crm.deals.find((item) => item.id === input.id)
  if (!row) {
    row = { id: input.id || nextId('HK', crm.deals) }
    crm.deals.push(row)
  }
  Object.assign(row, {
    id: row.id,
    buyer,
    sku: clip(input.sku || row.sku, 40),
    qty: Number(input.qty || row.qty || 0) || 0,
    status: pick(input.status, DEAL_STATUS, row.status || 'new'),
    next: clip(input.next || row.next, 200),
    due: clip(input.due || row.due, 20),
    file: clip(input.file || row.file, 120) || `deals/${row.id}.md`,
    leadId: clip(input.leadId || input.lead_id || row.leadId, 40),
    updatedAt: new Date().toISOString(),
  })
  saveCrm(crm, root)
  return row
}

export function listLeads({ group, market, q } = {}, root = workspaceRoot()) {
  const crm = loadCrm(root)
  const needle = String(q || '').trim().toLowerCase()
  return crm.leads.filter((row) => {
    if (group && row.group !== group) return false
    if (market && String(row.market).toLowerCase() !== String(market).toLowerCase()) return false
    if (!needle) return true
    const hay = [row.id, row.company, row.market, row.source, row.next, row.sku].join(' ').toLowerCase()
    return hay.includes(needle)
  })
}

export function listDeals({ status, q } = {}, root = workspaceRoot()) {
  const crm = loadCrm(root)
  const needle = String(q || '').trim().toLowerCase()
  return crm.deals.filter((row) => {
    if (status && row.status !== status) return false
    if (!needle) return true
    const hay = [row.id, row.buyer, row.sku, row.next].join(' ').toLowerCase()
    return hay.includes(needle)
  })
}

export function pipelineSummary(root = workspaceRoot()) {
  const crm = loadCrm(root)
  const byGroup = Object.fromEntries(GROUPS.map((key) => [key, crm.leads.filter((row) => row.group === key).length]))
  const byStatus = Object.fromEntries(DEAL_STATUS.map((key) => [key, crm.deals.filter((row) => row.status === key).length]))
  return {
    leads: crm.leads.length,
    deals: crm.deals.length,
    byGroup,
    byStatus,
    next: [
      ...crm.leads.filter((row) => row.group === 'hot' || row.due).slice(0, 8).map((row) => `${row.id} ${row.company} · ${row.group} · ${row.next || '（无下一步）'}`),
      ...crm.deals.filter((row) => !['lost', 'shipped', 'after-sales'].includes(row.status)).slice(0, 8).map((row) => `${row.id} ${row.buyer} · ${row.status} · ${row.next || '（无下一步）'}`),
    ],
  }
}

export function findProduct(skuOrId, root = workspaceRoot()) {
  const catalog = loadCatalog(root)
  const key = String(skuOrId || '').trim().toLowerCase()
  if (!key) return null
  return catalog.find((row) => row.sku.toLowerCase() === key || row.id.toLowerCase() === key || row.slug === key) || null
}

export function quoteCatalog({ sku, qty, buyer = '' } = {}, root = workspaceRoot()) {
  const product = findProduct(sku, root)
  if (!product) throw new Error(`unknown SKU: ${sku}`)
  const count = Number(qty)
  if (!Number.isInteger(count) || count < 1) throw new Error('qty must be a positive integer')
  const lineUsd = Number((product.priceUsd * count).toFixed(2))
  const shippingUsd = lineUsd >= 500 ? 0 : 48
  const belowMoq = count < product.moq
  const valid = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return {
    buyer: buyer || 'TBD buyer',
    date: today,
    validUntil: valid,
    sku: product.sku,
    name: product.name,
    qty: count,
    unitUsd: product.priceUsd,
    amountUsd: lineUsd,
    shippingUsd,
    totalUsd: Number((lineUsd + shippingUsd).toFixed(2)),
    moq: product.moq,
    belowMoq,
    incoterm: product.incoterm,
    leadDays: product.leadDays,
    certs: product.certs,
    markdown: [
      `# Quotation ${product.sku}`,
      '',
      `**Buyer:** ${buyer || 'TBD'}`,
      `**Date:** ${today}`,
      `**Valid until:** ${valid}`,
      `**Incoterm:** ${product.incoterm}`,
      '',
      '| SKU | Description | Qty | Unit USD | Amount USD |',
      '| --- | --- | ---: | ---: | ---: |',
      `| ${product.sku} | ${product.name.en} | ${count} | ${product.priceUsd.toFixed(2)} | ${lineUsd.toFixed(2)} |`,
      '',
      `**Merchandise:** USD ${lineUsd.toFixed(2)}`,
      `**Export handling:** USD ${shippingUsd.toFixed(2)} (waived at $500+)`,
      `**Total:** USD ${(lineUsd + shippingUsd).toFixed(2)}`,
      '',
      `MOQ ${product.moq}${belowMoq ? ` — this qty is below MOQ, factory may requote` : ''}. Lead time ~${product.leadDays} days. Certs on this SKU: ${product.certs.join(', ') || 'TBD, factory confirm'}.`,
      'Payment (demo default): 30% T/T deposit, 70% against B/L copy. Destination duties/VAT not included.',
      'This is a draft quotation. Bottom price stays internal.',
    ].join('\n'),
  }
}

export function draftOutreach({ leadId, sku } = {}, root = workspaceRoot()) {
  const crm = loadCrm(root)
  const lead = crm.leads.find((row) => row.id === leadId) || crm.leads.find((row) => row.company === leadId)
  if (!lead) throw new Error(`unknown lead: ${leadId}`)
  const product = findProduct(sku || lead.sku, root) || loadCatalog(root)[0]
  if (!product) throw new Error('catalog is empty')
  const fact = lead.sourceUrl
    ? `your public page ${lead.sourceUrl}`
    : (lead.source || 'a public listing (URL still TBD — do not invent an email)')
  const letter = [
    `Subject: ${product.name.en} for ${lead.company} — Harbor Kiln`,
    '',
    `Hi ${lead.company} team,`,
    '',
    `I saw ${fact}.`,
    '',
    `Harbor Kiln supplies ${product.name.en} (${product.sku}) ${product.incoterm}. Spec: ${product.specs.en[0]}. Papers on this SKU: ${product.certs.join(', ') || 'TBD'}. MOQ ${product.moq}.`,
    '',
    `If useful I can send a sample pack and a 14-day USD quote for ${product.moq}+ pcs.`,
    '',
    'Would a 15-minute call this week work?',
    '',
    'Best regards,',
    'Harbor Kiln team',
    '',
    '---',
    'INTERNAL: draft only, not sent. Do not invent email/WhatsApp/LinkedIn. Touch status stays draft until the user says they sent it.',
  ].join('\n')
  return { lead, product: { sku: product.sku, name: product.name.en }, letter }
}

export function searchQueries({ product, market } = {}, root = workspaceRoot()) {
  const item = findProduct(product, root)
  const name = item ? item.name.en : String(product || 'stainless tumbler')
  const place = String(market || 'EU').trim() || 'EU'
  return {
    note: '没有海关提单库。用官方 web_search 跑这些查询，再用 mcp__web-search__web_fetch 打开公司页，最后 mcp__trade-crm__upsert_lead。禁止编造邮箱。',
    queries: [
      `${name} importer wholesaler ${place}`,
      `${name} housewares distributor ${place}`,
      `${place} hotel amenities drinkware buyer`,
      `${place} homeware importer stainless tumbler`,
      `${place} hospitality procurement mug tumbler`,
    ],
  }
}

export function exportLeadsCsv(root = workspaceRoot()) {
  const rows = listLeads({}, root)
  const header = ['id', 'company', 'market', 'group', 'source', 'sourceUrl', 'touch', 'next', 'due', 'sku']
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(header.map((key) => csvCell(row[key])).join(','))
  }
  return lines.join('\n')
}

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function renderLeadsMarkdown(leads) {
  const lines = [
    '# 线索池',
    '',
    '对齐网易外贸通「运营专家」：分组、沉睡激活。没有海关库。线索只能来自 `web_search` / 独立站询盘 / 用户提供的名片。',
    '',
    '分组：`hot` / `warm` / `nurture` / `sleeping` / `closed`。触达只允许 `draft` / `user-sent` / `replied` / `none`。',
    '没有公开邮箱就留空，不要编。机器写入走 `mcp__trade-crm__*`，本文件由 sync 镜像，不要手改表格。',
    '',
    '| 编号 | 公司 | 市场 | 分组 | 来源 | 触达 | 下一步 | 截止日期 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ]
  for (const row of leads) {
    const source = row.sourceUrl ? `[${row.source}](${row.sourceUrl})` : (row.source || '')
    lines.push(`| ${row.id} | ${row.company} | ${row.market} | ${row.group} | ${source} | ${row.touch} | ${row.next || ''} | ${row.due || ''} |`)
  }
  lines.push('')
  lines.push('真实邮箱、电话、WhatsApp 写 `team/deals/local/`，不要提交。')
  lines.push('')
  return lines.join('\n')
}

export function renderPipelineMarkdown(deals) {
  const lines = [
    '# 成交看板',
    '',
    '尚未报价的挖客线索在 `crm/leads.md`。这里只放已经进入询盘/报价的商机。',
    '',
    '状态：`new` → `quoted` → `sample` → `pi` → `deposit` → `production` → `qc` → `shipped` → `after-sales`。丢失或暂停用 `lost` / `on-hold`。',
    '',
    '| 编号 | 客户 | SKU | 状态 | 下一步 | 截止日期 | 档案 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ]
  for (const row of deals) {
    lines.push(`| ${row.id} | ${row.buyer} | ${row.sku || ''} | ${row.status} | ${row.next || ''} | ${row.due || ''} | \`${row.file || ''}\` |`)
  }
  lines.push('')
  return lines.join('\n')
}

export function saveCrm(crm, root = workspaceRoot()) {
  const paths = crmPaths(root)
  writeJson(paths.leadsJson, { updatedAt: new Date().toISOString(), leads: crm.leads })
  writeJson(paths.dealsJson, { updatedAt: new Date().toISOString(), deals: crm.deals })
  writeFileSync(paths.leadsMd, renderLeadsMarkdown(crm.leads))
  writeFileSync(paths.pipelineMd, renderPipelineMarkdown(crm.deals))
  return crm
}

export function formatLeads(rows) {
  if (!rows.length) return 'No leads. Use upsert_lead after a public-web search (never invent emails).'
  return rows.map((row) => [
    `${row.id}  ${row.company}  [${row.market}]  ${row.group}/${row.touch}`,
    `  source: ${row.sourceUrl || row.source || ''}`,
    `  next: ${row.next || '（无）'}  due: ${row.due || '—'}  sku: ${row.sku || '—'}`,
  ].join('\n')).join('\n')
}

export function formatDeals(rows) {
  if (!rows.length) return 'No deals in pipeline. Promote a hot lead with upsert_deal after an inquiry/quote.'
  return rows.map((row) => `${row.id}  ${row.buyer}  ${row.sku || '—'}  ${row.status}  next: ${row.next || '（无）'}  ${row.file || ''}`).join('\n')
}
