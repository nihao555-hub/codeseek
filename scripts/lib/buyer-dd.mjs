/**
 * 公开源买家背调：OpenCorporates 公司库 + OpenSanctions 制裁名单。
 * 不是海关提单。没有的字段标 TBD，禁止编造货值/采购量。
 */
const UA = 'codeseek-buyer-dd/1.0 (+https://github.com/nihao555-hub/codeseek)'

export function normalizeCompanyName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function formatCompanyHits(query, companies) {
  const q = normalizeCompanyName(query)
  if (!companies.length) {
    return [
      `OpenCorporates: no company hit for "${q}".`,
      'This is not a customs database. Continue with official web_search + registry sites for that country.',
    ].join('\n')
  }
  const lines = [`OpenCorporates search: ${q}`, `Hits: ${companies.length}`, '']
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

async function fetchJson(url, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const res = await fetchImpl(url, {
    headers: { 'user-agent': UA, accept: 'application/json' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`)
  }
  return JSON.parse(body)
}

export async function searchCompanies(query, { fetchImpl = fetch } = {}) {
  const q = normalizeCompanyName(query)
  if (!q) return { source: 'opencorporates', results: [], text: 'Missing company name.' }
  const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(q)}&per_page=8`
  try {
    const data = await fetchJson(url, { fetchImpl })
    const results = parseOpenCorporates(data)
    return { source: 'opencorporates', results, text: formatCompanyHits(q, results) }
  } catch (err) {
    return {
      source: 'opencorporates',
      results: [],
      text: `OpenCorporates failed (${err instanceof Error ? err.message : err}). Fall back to web_search for the national company register.`,
    }
  }
}

export async function searchSanctions(query, { fetchImpl = fetch } = {}) {
  const q = normalizeCompanyName(query)
  if (!q) return { source: 'opensanctions', results: [], text: 'Missing name.' }
  const url = `https://api.opensanctions.org/search/default?q=${encodeURIComponent(q)}`
  try {
    const data = await fetchJson(url, { fetchImpl })
    const results = parseOpenSanctions(data)
    return { source: 'opensanctions', results, text: formatSanctionsHits(q, results) }
  } catch (err) {
    return {
      source: 'opensanctions',
      results: [],
      text: `OpenSanctions failed (${err instanceof Error ? err.message : err}). Fall back to web_search site:sanctionssearch.ofac.treas.gov.`,
    }
  }
}
