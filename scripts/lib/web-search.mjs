/**
 * 开源联网搜索：优先 SearXNG JSON API，失败则解析 DuckDuckGo HTML。
 * 不依赖付费搜索密钥。
 */

export const DEFAULT_SEARXNG_URLS = [
  'https://searx.tiekoetter.com',
  'https://priv.au',
  'https://search.ononoki.org',
  'https://opnxng.com',
  'https://paulgo.io',
]

const UA = 'Mozilla/5.0 (compatible; codeseek-web-search/1.0)'

export function splitSearxUrls(raw) {
  const text = String(raw || '').trim()
  if (!text) return [...DEFAULT_SEARXNG_URLS]
  return text.split(/[;\s]+/).map((item) => item.replace(/\/$/, '')).filter(Boolean)
}

export function parseSearxJson(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  const results = Array.isArray(data?.results) ? data.results : []
  return results.slice(0, 8).map((row) => ({
    title: String(row.title || row.url || '').trim(),
    url: String(row.url || '').trim(),
    snippet: String(row.content || row.pretty_url || '').trim(),
    engine: 'searxng',
  })).filter((row) => row.url)
}

export function parseDdgHtml(html) {
  const source = String(html || '')
  const rows = []
  const re = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  for (const match of source.matchAll(re)) {
    let href = match[1].replace(/&amp;/g, '&')
    const uddg = /[?&]uddg=([^&]+)/.exec(href)
    if (uddg) {
      try {
        href = decodeURIComponent(uddg[1])
      } catch {
        href = uddg[1]
      }
    } else if (href.startsWith('//')) {
      href = `https:${href}`
    }
    const title = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (!href.startsWith('http') || rows.some((row) => row.url === href)) continue
    rows.push({ title: title || href, url: href, snippet: '', engine: 'duckduckgo' })
    if (rows.length >= 8) break
  }
  return rows
}

function formatResults(query, results, source) {
  if (!results.length) return `No results for ${query} (tried ${source}).`
  const lines = [`Search: ${query}`, `Source: ${source}`, '']
  for (const [i, row] of results.entries()) {
    lines.push(`${i + 1}. ${row.title}`)
    lines.push(`   ${row.url}`)
    if (row.snippet) lines.push(`   ${row.snippet.replace(/\s+/g, ' ').slice(0, 280)}`)
  }
  return lines.join('\n')
}

async function fetchText(url, { fetchImpl = fetch, timeoutMs = 12000, headers = {} } = {}) {
  const res = await fetchImpl(url, {
    headers: { 'user-agent': UA, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await res.text()
  return { ok: res.ok, status: res.status, contentType: res.headers.get('content-type') || '', body }
}

export async function searchWeb(query, { searxUrls, fetchImpl = fetch } = {}) {
  const q = String(query || '').trim()
  if (!q) return { source: 'none', results: [], text: 'Missing query.' }
  const urls = splitSearxUrls(searxUrls ?? process.env.SEARXNG_URL)
  const errors = []
  for (const base of urls) {
    const target = `${base.replace(/\/$/, '')}/search?q=${encodeURIComponent(q)}&format=json&language=all`
    try {
            const got = await fetchText(target, { fetchImpl, timeoutMs: 6000, headers: { accept: 'application/json' } })
      if (!got.ok) {
        errors.push(`${base} HTTP ${got.status}`)
        continue
      }
      const results = parseSearxJson(got.body)
      if (results.length) {
        return { source: `searxng:${base}`, results, text: formatResults(q, results, `searxng ${base}`) }
      }
      errors.push(`${base} empty`)
    } catch (error) {
      errors.push(`${base} ${error instanceof Error ? error.message : error}`)
    }
  }

  const ddg = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
  try {
    const got = await fetchText(ddg, { fetchImpl })
    const results = parseDdgHtml(got.body)
    if (results.length) {
      return {
        source: 'duckduckgo',
        results,
        text: formatResults(q, results, `duckduckgo html (searxng failed: ${errors.slice(0, 3).join('; ')})`),
      }
    }
    errors.push(`duckduckgo empty HTTP ${got.status}`)
  } catch (error) {
    errors.push(`duckduckgo ${error instanceof Error ? error.message : error}`)
  }

  return { source: 'none', results: [], text: `Search failed for ${q}. ${errors.join(' | ')}` }
}

export function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchPage(url, { fetchImpl = fetch, maxChars = 8000 } = {}) {
  const target = String(url || '').trim()
  if (!/^https?:\/\//i.test(target)) return 'URL must start with http:// or https://'
  const got = await fetchText(target, { fetchImpl, timeoutMs: 20000 })
  const text = htmlToText(got.body).slice(0, maxChars)
  return `HTTP ${got.status} ${target}\n\n${text || '(empty body)'}`
}
