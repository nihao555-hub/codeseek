/**
 * 公开源买家背调：OpenCorporates 公司库 + OpenSanctions 制裁名单。
 * API 要密钥时回退 GLEIF（LEI）和 OpenSanctions 公开 HTML。
 * 不是海关提单。没有的字段标 TBD，禁止编造货值/采购量。
 */
const UA = 'codeseek-buyer-dd/1.0 (+https://github.com/nihao555-hub/codeseek)'

export function normalizeCompanyName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function formatCompanyHits(query, companies, source = 'opencorporates') {
  const q = normalizeCompanyName(query)
  if (!companies.length) {
    return [
      `${source}: no company hit for "${q}".`,
      'This is not a customs database. Continue with official web_search + registry sites for that country.',
    ].join('\n')
  }
  const lines = [`${source} search: ${q}`, `Hits: ${companies.length}`, '']
  for (const [i, row] of companies.entries()) {
    lines.push(`${i + 1}. ${row.name}`)
    if (row.companyNumber) lines.push(`   number: ${row.companyNumber}`)
    if (row.jurisdiction) lines.push(`   jurisdiction: ${row.jurisdiction}`)
    if (row.status) lines.push(`   status: ${row.status}`)
    if (row.address) lines.push(`   address: ${row.address}`)
    if (row.url) lines.push(`   ${row.url}`)
  }
  lines.push('', 'Do not treat a registry hit as import volume. Unknown fields stay TBD.')
  return lines.join('\n')
}

export function parseOpenCorporates(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  const rows = data?.results?.companies || []
  return rows.slice(0, 8).map((wrap) => {
    const company = wrap.company || wrap
    return {
      name: String(company.name || '').trim(),
      companyNumber: String(company.company_number || '').trim(),
      jurisdiction: String(company.jurisdiction_code || '').trim(),
      status: String(company.current_status || '').trim(),
      address: String(company.registered_address_in_full || '').trim(),
      url: String(company.opencorporates_url || '').trim(),
    }
  }).filter((row) => row.name)
}

export function parseGleif(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  const rows = Array.isArray(data?.data) ? data.data : []
  return rows.slice(0, 8).map((row) => {
    const entity = row.attributes?.entity || {}
    const legal = entity.legalAddress || {}
    const address = [...(legal.addressLines || []), legal.city, legal.country].filter(Boolean).join(', ')
    const lei = String(row.attributes?.lei || row.id || '').trim()
    return {
      name: String(entity.legalName?.name || '').trim(),
      companyNumber: lei,
      jurisdiction: String(entity.jurisdiction || legal.country || '').trim(),
      status: String(row.attributes?.registration?.status || entity.status || '').trim(),
      address,
      url: lei ? `https://search.gleif.org/#/record/${lei}` : '',
    }
  }).filter((row) => row.name)
}

export function parseOpenSanctions(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  const rows = Array.isArray(data?.results) ? data.results : []
  return rows.slice(0, 8).map((row) => ({
    id: String(row.id || '').trim(),
    caption: String(row.caption || row.id || '').trim(),
    schema: String(row.schema || '').trim(),
    datasets: Array.isArray(row.datasets) ? row.datasets.slice(0, 6) : [],
    score: row.score,
    url: row.id ? `https://www.opensanctions.org/entities/${row.id}/` : '',
  })).filter((row) => row.caption)
}

export function parseOpenSanctionsHtml(html) {
  const source = String(html || '').replace(/\\"/g, '"')
  const hits = []
  const seen = new Set()
  const re = /\/entities\/([a-z0-9-]+)\//g
  let match
  while ((match = re.exec(source))) {
    const id = match[1]
    if (seen.has(id)) continue
    seen.add(id)
    const window = source.slice(Math.max(0, match.index - 80), Math.min(source.length, match.index + 220))
    const named = /"children":"([^"]{2,120})"/.exec(window)
    const caption = named?.[1] || id
    hits.push({
      id,
      caption,
      schema: 'entity',
      datasets: [],
      url: `https://www.opensanctions.org/entities/${id}/`,
    })
    if (hits.length >= 8) break
  }
  return hits
}

export function formatSanctionsHits(query, hits) {
  const q = normalizeCompanyName(query)
  if (!hits.length) {
    return [
      `OpenSanctions: no list hit for "${q}".`,
      'Not a clearance. Recheck spelling, local script, and OFAC SDN / EU/UN lists via web_search.',
    ].join('\n')
  }
  const lines = [
    `OpenSanctions search: ${q}`,
    'POSSIBLE MATCH — human must confirm identity. Do not tell the user the buyer is "cleared".',
    '',
  ]
  for (const [i, row] of hits.entries()) {
    lines.push(`${i + 1}. ${row.caption} (${row.schema || 'entity'})`)
    if (row.datasets.length) lines.push(`   lists: ${row.datasets.join(', ')}`)
    if (row.url) lines.push(`   ${row.url}`)
  }
  return lines.join('\n')
}

function headers(extra = {}) {
  return { 'user-agent': UA, ...extra }
}

async function fetchText(url, { fetchImpl = fetch, timeoutMs = 15000, extraHeaders = {} } = {}) {
  const res = await fetchImpl(url, {
    headers: headers(extraHeaders),
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return body
}

async function fetchJson(url, opts = {}) {
  return JSON.parse(await fetchText(url, {
    ...opts,
    extraHeaders: { accept: 'application/json', ...(opts.extraHeaders || {}) },
  }))
}

function fallbackReason(error) {
  const msg = error instanceof Error ? error.message : String(error)
  if (/\b401\b|\b403\b/.test(msg)) return 'no public API token'
  if (/\b429\b/.test(msg)) return 'rate limited'
  if (/\b5\d{2}\b/.test(msg)) return 'upstream busy'
  return 'temporarily unavailable'
}

function gleifQueries(query) {
  const q = normalizeCompanyName(query)
  const out = [q]
  const stripped = q
    .replace(/\b(of|the|ab|asa|oy|oyj|as|aps|gmbh|ltd|llc|inc|co|company|group|holdings)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped && stripped !== q) out.push(stripped)
  return [...new Set(out)]
}

function ocSearchUrl(query) {
  const url = new URL('https://api.opencorporates.com/v0.4/companies/search')
  url.searchParams.set('q', query)
  url.searchParams.set('per_page', '8')
  const token = process.env.OPENCORPORATES_API_TOKEN
  if (token) url.searchParams.set('api_token', token)
  return url.toString()
}

export async function searchCompanies(query, { fetchImpl = fetch } = {}) {
  const q = normalizeCompanyName(query)
  if (!q) return { source: 'opencorporates', results: [], text: 'Missing company name.' }

  try {
    const extraHeaders = {}
    if (process.env.OPENCORPORATES_API_TOKEN) {
      extraHeaders.authorization = `Bearer ${process.env.OPENCORPORATES_API_TOKEN}`
    }
    const data = await fetchJson(ocSearchUrl(q), { fetchImpl, extraHeaders })
    const results = parseOpenCorporates(data)
    return { source: 'opencorporates', results, text: formatCompanyHits(q, results, 'opencorporates') }
  } catch (ocErr) {
    try {
      let results = []
      let used = ''
      for (const attempt of gleifQueries(q)) {
        const gleifUrl = `https://api.gleif.org/api/v1/lei-records?page[size]=8&filter[fulltext]=${encodeURIComponent(attempt)}`
        const data = await fetchJson(gleifUrl, { fetchImpl })
        results = parseGleif(data)
        used = attempt
        if (results.length) break
      }
      const note = `OpenCorporates unavailable (${fallbackReason(ocErr)}). Showing GLEIF LEI records instead${used && used !== q ? ` (query: ${used})` : ''}.`
      return {
        source: 'gleif',
        results,
        text: `${note}\n${formatCompanyHits(q, results, 'gleif')}`,
      }
    } catch (gleifErr) {
      return {
        source: 'opencorporates',
        results: [],
        text: `OpenCorporates failed (${fallbackReason(ocErr)}). GLEIF failed (${fallbackReason(gleifErr)}). Fall back to web_search for the national company register.`,
      }
    }
  }
}

export async function searchSanctions(query, { fetchImpl = fetch } = {}) {
  const q = normalizeCompanyName(query)
  if (!q) return { source: 'opensanctions', results: [], text: 'Missing name.' }
  const apiUrl = `https://api.opensanctions.org/search/default?q=${encodeURIComponent(q)}`
  try {
    const extraHeaders = {}
    if (process.env.OPENSANCTIONS_API_KEY) {
      extraHeaders.authorization = `Bearer ${process.env.OPENSANCTIONS_API_KEY}`
    }
    const data = await fetchJson(apiUrl, { fetchImpl, extraHeaders })
    const results = parseOpenSanctions(data)
    return { source: 'opensanctions', results, text: formatSanctionsHits(q, results) }
  } catch (apiErr) {
    try {
      const html = await fetchText(`https://www.opensanctions.org/search/?q=${encodeURIComponent(q)}`, {
        fetchImpl,
        extraHeaders: { accept: 'text/html' },
      })
      const results = parseOpenSanctionsHtml(html)
      const note = `OpenSanctions API unavailable (${fallbackReason(apiErr)}). Parsed public HTML search.`
      return {
        source: 'opensanctions-html',
        results,
        text: `${note}\n${formatSanctionsHits(q, results)}`,
      }
    } catch (htmlErr) {
      return {
        source: 'opensanctions',
        results: [],
        text: `OpenSanctions failed (${fallbackReason(apiErr)}). HTML fallback failed (${fallbackReason(htmlErr)}). Fall back to web_search site:sanctionssearch.ofac.treas.gov.`,
      }
    }
  }
}
