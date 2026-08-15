/**
 * 港窑实时活动快照：右侧面板每 2 秒拉一次。
 * 报价数字只来自 catalog.json；线索来自 team/crm 公开检索落盘。
 */
import { loadCatalog, loadCrm, pipelineSummary } from './trade-crm.mjs'

export const QUOTE_NOTE = '报价金额是港窑目录价，不是买家询盘，也不是海关货值。'

export const REUSED_PLUGINS = [
  {
    id: 'dsh-hud',
    repo: 'a903067276-rgb/dsh-hud',
    why: '复用官方 shell.overlay + conversation.input.left 槽位；不装其 Git/token HUD。',
  },
  {
    id: 'dsh-better-sidebar',
    repo: 'omdsh-dev/DSH-better-sidebar',
    why: '右侧栏工作台带终端/Git/pty，太重且要 approve-builds；本产品只要看 agent 在干什么。',
  },
  {
    id: 'dsh-task-status',
    repo: 'vlln/dsh-task-status',
    why: '后台任务条走 conversation.input.dock。本面板直接读 runningCalls / 子代理。',
  },
]

function briefLead(row) {
  return {
    id: row.id,
    company: row.company,
    market: row.market,
    group: row.group,
    touch: row.touch,
    sku: row.sku || '',
    sourceUrl: row.sourceUrl || '',
    source: row.source || '',
    next: row.next || '',
  }
}

function briefDeal(row) {
  return {
    id: row.id,
    buyer: row.buyer,
    sku: row.sku,
    qty: row.qty,
    status: row.status,
    file: row.file || '',
    next: row.next || '',
  }
}

export function activitySnapshot(root) {
  const crm = loadCrm(root)
  const catalog = loadCatalog(root).map((row) => ({
    sku: row.sku,
    name: row.name?.zh || row.name?.en || row.sku,
    priceUsd: row.priceUsd,
    moq: row.moq,
    incoterm: row.incoterm,
    certs: row.certs || [],
  }))
  const leads = [...crm.leads].reverse().slice(0, 8).map(briefLead)
  const deals = [...crm.deals].reverse().slice(0, 8).map(briefDeal)
  return {
    updatedAt: new Date().toISOString(),
    quoteSource: 'store/data/catalog.json',
    quoteNote: QUOTE_NOTE,
    catalog,
    leads,
    deals,
    summary: pipelineSummary(root),
    reused: REUSED_PLUGINS,
  }
}
