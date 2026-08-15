/**
 * 开源外贸数据：UN Comtrade 官方 preview（国家×HS 年度统计，不是提单），
 * 以及 GitHub LensmorOfficial/trade-show-calendar 展会日历。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const UA = 'codeseek-trade-open-data/1.0 (+https://github.com/nihao555-hub/codeseek)'
const REPO = join(dirname(fileURLToPath(import.meta.url)), '../..')
const FAIRS_LOCAL = join(REPO, 'toolkit/data/trade-shows.json')
const FAIRS_REMOTE = 'https://raw.githubusercontent.com/LensmorOfficial/trade-show-calendar/main/data/trade_shows.json'
const COMTRADE_PREVIEW = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS'

/** ISO-ish names / aliases → UN M49 reporter codes */
export const REPORTER_CODES = {
  SE: '752', Sweden: '752', 瑞典: '752',
  NO: '578', Norway: '578', 挪威: '578',
  DK: '208', Denmark: '208', 丹麦: '208',
  FI: '246', Finland: '246', 芬兰: '246',
  DE: '276', Germany: '276', 德国: '276',
  NL: '528', Netherlands: '528', 荷兰: '528',
  FR: '250', France: '250', 法国: '250',
  IT: '380', Italy: '380', 意大利: '380',
  ES: '724', Spain: '724', 西班牙: '724',
  GB: '826', UK: '826', 英国: '826',
  US: '842', USA: '842', 美国: '842',
  CN: '156', China: '156', 中国: '156',
  JP: '392', Japan: '392', 日本: '392',
  KR: '410', Korea: '410', 韩国: '410',
  ID: '360', Indonesia: '360', 印尼: '360',
  MY: '458', Malaysia: '458', 马来: '458',
  SG: '702', Singapore: '702', 新加坡: '702',
  TH: '764', Thailand: '764', 泰国: '764',
  VN: '704', Vietnam: '704', 越南: '704',
  AE: '784', UAE: '784', 阿联酋: '784',
  SA: '682', 'Saudi Arabia': '682', 沙特: '682',
  AU: '36', Australia: '36', 澳洲: '36',
  PL: '616', Poland: '616', 波兰: '616',
  Nordics: '752', 北欧: '752',
}

const HS_BY_HINT = [
  { re: /tumbler|flask|vacuum|保温杯|真空杯|9617/i, hs: '9617', label: 'vacuum flasks / tumblers' },
  { re: /mug|ceramic|陶瓷|6912/i, hs: '6912', label: 'ceramic tableware' },
  { re: /配电|switchgear|electrical panel|8537/i, hs: '8537', label: 'boards / panels for electric control' },
  { re: /cable|电线|8544/i, hs: '8544', label: 'insulated wire and cable' },
]

export function resolveReporter(market) {
  const raw = String(market || '').trim()
  if (/^\d{1,3}$/.test(raw)) return raw
  if (REPORTER_CODES[raw]) return REPORTER_CODES[raw]
  const key = Object.keys(REPORTER_CODES).find((name) => raw.toLowerCase().includes(String(name).toLowerCase()))
  return key ? REPORTER_CODES[key] : ''
}

export function resolveHs(product) {
  const raw = String(product || '').trim()
  if (/^\d{4,6}$/.test(raw)) return { hs: raw, label: `HS ${raw}` }
  const hit = HS_BY_HINT.find((row) => row.re.test(raw))
  return hit || { hs: '9617', label: 'vacuum flasks / tumblers (default Harbor Kiln)' }
}

export function parseComtradePreview(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
  return rows.slice(0, 30).map((row) => ({
    period: String(row.period || row.periodDesc || ''),
    reporter: String(row.reporterDesc || row.reporterISO || row.reporterCode || ''),
    partner: String(row.partnerDesc || row.partnerISO || row.partnerCode || ''),
    flow: String(row.flowDesc || row.flowCode || ''),
    hs: String(row.cmdCode || row.cmdDesc || ''),
    hsDesc: String(row.cmdDesc || '').slice(0, 160),
    usd: row.primaryValue ?? row.cifvalue ?? row.fobvalue ?? null,
    qty: row.qty ?? row.altQty ?? null,
    qtyUnit: String(row.qtyUnitAbbr || row.altQtyUnitAbbr || ''),
  }))
}

export function formatComtrade(rows, { reporter, hs, note } = {}) {
  const lines = [
    `UN Comtrade preview (official aggregate stats, NOT bills of lading).`,
    `reporter=${reporter || '?'} HS=${hs || '?'}`,
    note || 'Use this to size a market. Do not invent importer company names from these rows.',
    '',
  ]
  if (!rows.length) {
    lines.push('No preview rows. Try another year, reporter, or HS. Free preview is capped and rate-limited.')
    return lines.join('\n')
  }
  for (const [i, row] of rows.entries()) {
    const usd = row.usd == null ? 'TBD' : `USD ${Number(row.usd).toLocaleString('en-US')}`
    const qty = row.qty == null ? '' : ` qty ${row.qty} ${row.qtyUnit}`.trimEnd()
    lines.push(`${i + 1}. ${row.period} ${row.reporter} ${row.flow} ${row.hs} from/to ${row.partner}: ${usd}${qty}`)
    if (row.hsDesc) lines.push(`   ${row.hsDesc}`)
  }
  return lines.join('\n')
}

export async function previewComtrade({ market, product, period, flow } = {}, { fetchImpl = fetch } = {}) {
  const reporter = resolveReporter(market)
  const { hs, label } = resolveHs(product)
  if (!reporter) {
    return {
      ok: false,
      text: `Unknown market "${market || ''}". Use a country name or ISO (SE, DE, US, ID…). Nordics defaults to Sweden (752).`,
    }
  }
  const year = String(period || new Date().getUTCFullYear() - 1)
  const flowCode = /export|出口/i.test(String(flow || '')) ? 'X' : 'M'
  const url = new URL(COMTRADE_PREVIEW)
  url.searchParams.set('reporterCode', reporter)
  url.searchParams.set('period', year)
  url.searchParams.set('flowCode', flowCode)
  url.searchParams.set('cmdCode', hs)
  url.searchParams.set('partnerCode', '0')
  url.searchParams.set('includeDesc', 'true')
  url.searchParams.set('maxRecords', '20')
  const res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'application/json' } })
  const body = await res.text()
  if (!res.ok) {
    return {
      ok: false,
      text: `UN Comtrade preview unavailable (${res.status}). This is official country/HS totals, not a bill-of-lading database. Retry later or set a free Comtrade key.`,
    }
  }
  let rows = []
  try {
    rows = parseComtradePreview(body)
  } catch {
    return { ok: false, text: 'UN Comtrade preview returned non-JSON. Not a customs BOL feed.' }
  }
  return {
    ok: true,
    reporter,
    hs,
    text: formatComtrade(rows, { reporter: `${market} (${reporter})`, hs: `${hs} ${label}` }),
  }
}

export function parseFairs(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  const rows = Array.isArray(data) ? data : []
  return rows.map((row) => ({
    name: String(row.name || '').trim(),
    website: String(row.website || '').trim(),
    city: String(row.city || '').trim(),
    country: String(row.country || '').trim(),
    start: String(row.start_date || '').trim(),
    end: String(row.end_date || '').trim(),
    industry: String(row.industry || '').trim(),
    region: String(row.region || '').trim(),
    notes: String(row.notes || '').trim(),
  })).filter((row) => row.name)
}

function loadLocalFairs() {
  if (!existsSync(FAIRS_LOCAL)) return []
  try {
    return parseFairs(readFileSync(FAIRS_LOCAL, 'utf8'))
  } catch {
    return []
  }
}

export async function loadFairs({ fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(FAIRS_REMOTE, { headers: { 'user-agent': UA, accept: 'application/json' } })
    if (res.ok) {
      const remote = parseFairs(await res.text())
      if (remote.length) return { rows: remote, source: 'github:LensmorOfficial/trade-show-calendar' }
    }
  } catch {
    // fall through to the vendored snapshot
  }
  return { rows: loadLocalFairs(), source: 'local snapshot toolkit/data/trade-shows.json' }
}

export function filterFairs(rows, { q, country, industry, region } = {}) {
  const needle = String(q || '').trim().toLowerCase()
  const place = String(country || '').trim().toLowerCase()
  const ind = String(industry || '').trim().toLowerCase()
  const reg = String(region || '').trim().toLowerCase()
  return rows.filter((row) => {
    if (place && !`${row.country} ${row.city}`.toLowerCase().includes(place)) return false
    if (ind && !row.industry.toLowerCase().includes(ind)) return false
    if (reg && !row.region.toLowerCase().includes(reg)) return false
    if (!needle) return true
    const hay = `${row.name} ${row.city} ${row.country} ${row.industry} ${row.notes}`.toLowerCase()
    return hay.includes(needle)
  })
}

export function formatFairs(rows, source) {
  const lines = [
    `Trade fairs from ${source}. Open calendar, not an exhibitor CRM.`,
    'Always confirm dates on the official website before booking.',
    '',
  ]
  if (!rows.length) {
    lines.push('No matching fairs in the open calendar. Fall back to official web_search for the fair name.')
    return lines.join('\n')
  }
  for (const [i, row] of rows.slice(0, 25).entries()) {
    lines.push(`${i + 1}. ${row.name} — ${row.city}, ${row.country} (${row.start} → ${row.end})`)
    lines.push(`   ${row.industry}${row.website ? ` · ${row.website}` : ''}`)
  }
  if (rows.length > 25) lines.push(`… ${rows.length - 25} more`)
  return lines.join('\n')
}

export async function searchFairs(query = {}, opts) {
  const loaded = await loadFairs(opts)
  const rows = filterFairs(loaded.rows, query)
  return { source: loaded.source, rows, text: formatFairs(rows, loaded.source) }
}

export function kickoffPlan({ market, product, text } = {}) {
  const source = `${market || ''} ${product || ''} ${text || ''}`
  const seats = [{ name: '营销专家', skill: 'trade-marketing', why: '公开检索挖客 + 开发信草稿' }]
  if (/报价|询盘|成交|PI|MOQ/i.test(source)) {
    seats.push({ name: '报价专员', skill: 'trade-quote', why: '有数量/SKU 再出目录报价' })
  }
  if (/背调|尽调|制裁/i.test(source)) {
    seats.push({ name: '背调专员', skill: 'trade-dd', why: '公开工商+制裁' })
  }
  return {
    seats,
    skip: ['广告专员', '社媒专家', '建站专家', '合规专员'],
    how: [
      '管家立刻 list_agents，没有营销专家就 subagent（description=营销专家），不要等人 @。',
      '一句话回群：已派营销开干。',
      '营销：search_queries → web_search / open-websearch → web_fetch → upsert_lead。',
      '市场体量用 mcp__trade-open-data__comtrade_preview（国家×HS，不是提单）。',
      '展会用 mcp__trade-open-data__list_fairs，再打开官网确认档期。',
      '用户说每天/每周：schedule_create（every_seconds 至少 300）。必须是加载定时 overlay 之后新建的会话。',
    ],
  }
}

export function formatKickoff(plan) {
  const lines = ['# 一句话开干', '', '立刻派：']
  for (const seat of plan.seats) lines.push(`- ${seat.name} (${seat.skill}) — ${seat.why}`)
  lines.push('', `先不要派：${plan.skip.join('、')}`, '', ...plan.how)
  return lines.join('\n')
}
