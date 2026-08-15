/**
 * 开源联网搜索：优先 SearXNG JSON API，失败则 DuckDuckGo / Wikipedia。
 * 公开实例常 429；状态码只进冷却与日志，不写给模型或 UI。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const DEFAULT_SEARXNG_URLS = [
  'https://searx.tiekoetter.com',
  'https://priv.au',
  'https://search.ononoki.org',
  'https://opnxng.com',
  'https://paulgo.io',
]

const UA = 'Mozilla/5.0 (compatible; codeseek-web-search/1.0)'
const RATE_LIMIT_STATUSES = new Set([429, 403, 418])
export const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000
export const DEFAULT_COOLDOWN_FILE = process.env.SEARX_COOLDOWN_FILE || '/tmp/codeseek-searx-cooldown.json'
const MAX_SEARX_ATTEMPTS = 3

const UA_HEADERS = { 'user-agent': UA }

export function splitSearxUrls(raw) {
  const text = String(raw || '').trim()
  if (!text) return [...DEFAULT_SEARXNG_URLS]
  return text.split(/[;\s]+/).map((item) => item.replace(/\/$/, '')).filter(Boolean)
}

export function isRateLimitedStatus(status) {
  return RATE_LIMIT_STATUSES.has(Number(status))
}

export function hostKey(url) {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return String(url || '').replace(/\/$/, '').toLowerCase()
  }
}

export function sanitizeSearchNoise(text) {
  return String(text || '')
    .replace(/https?:\/\/[^\s|;,)]+/gi, 'search-endpoint')
    .replace(/\bHTTP\s*[1-5]\d{2}\b/gi, 'unavailable')
    .replace(/\b(429|403|418)\b/g, 'busy')
    .replace(/too many requests/gi, 'busy')
    .replace(/rate.?limit(?:ed)?/gi, 'busy')
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

export function parseWikipediaOpensearch(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  if (!Array.isArray(data) || data.length < 4) return []
  const titles = Array.isArray(data[1]) ? data[1] : []
  const snippets = Array.isArray(data[2]) ? data[2] : []
  const urls = Array.isArray(data[3]) ? data[3] : []
  const rows = []
  for (let i = 0; i < urls.length && rows.length < 8; i++) {
    const url = String(urls[i] || '').trim()
    if (!url.startsWith('http')) continue
    rows.push({
      title: String(titles[i] || url).trim(),
      url,
      snippet: String(snippets[i] || '').trim(),
      engine: 'wikipedia',
    })
  }
  return rows
}

export function parseDdgInstant(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  const rows = []
  const push = (title, url, snippet) => {
    const href = String(url || '').trim()
    if (!href.startsWith('http') || rows.some((row) => row.url === href)) return
    rows.push({
      title: String(title || href).trim(),
      url: href,
      snippet: String(snippet || '').trim(),
      engine: 'duckduckgo',
    })
  }
  if (data?.AbstractURL) {
    push(data.Heading || data.AbstractURL, data.AbstractURL, data.AbstractText || '')
  }
  const topics = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : []
  for (const topic of topics) {
    if (topic?.FirstURL) push(topic.Text || topic.FirstURL, topic.FirstURL, topic.Text || '')
    if (Array.isArray(topic?.Topics)) {
      for (const child of topic.Topics) {
        if (child?.FirstURL) push(child.Text || child.FirstURL, child.FirstURL, child.Text || '')
      }
    }
    if (rows.length >= 8) break
  }
  return rows.slice(0, 8)
}

export function parseBraveWeb(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload
  const results = Array.isArray(data?.web?.results) ? data.web.results : []
  return results.slice(0, 8).map((row) => ({
    title: String(row.title || row.url || '').trim(),
    url: String(row.url || '').trim(),
    snippet: String(row.description || '').trim(),
    engine: 'brave',
  })).filter((row) => row.url)
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

function capResults(results, maxResults) {
  const cap = Number.isInteger(maxResults) && maxResults > 0 ? maxResults : 8
  return results.slice(0, cap)
}

export function createMemoryCooldown({ ttlMs = DEFAULT_COOLDOWN_MS, now = () => Date.now() } = {}) {
  const until = new Map()
  return {
    isCool(url) {
      const key = hostKey(url)
      const expiry = until.get(key) || 0
      return expiry > now()
    },
    mark(url, status) {
      if (!isRateLimitedStatus(status)) return
      until.set(hostKey(url), now() + ttlMs)
    },
  }
}

export function createFileCooldown({
  filePath = DEFAULT_COOLDOWN_FILE,
  ttlMs = DEFAULT_COOLDOWN_MS,
  now = () => Date.now(),
} = {}) {
  const readMap = () => {
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf8'))
      return data && typeof data === 'object' ? data : {}
    } catch {
      return {}
    }
  }
  const writeMap = (data) => {
    try {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, JSON.stringify(data))
    } catch {
      // 冷却文件写失败不影响搜索
    }
  }
  return {
    isCool(url) {
      const expiry = Number(readMap()[hostKey(url)] || 0)
      return expiry > now()
    },
    mark(url, status) {
      if (!isRateLimitedStatus(status)) return
      const data = readMap()
      data[hostKey(url)] = now() + ttlMs
      writeMap(data)
    },
  }
}

let defaultCooldown = createFileCooldown()

export function setDefaultCooldown(store) {
  defaultCooldown = store
}

function shuffle(list, random = Math.random) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

async function fetchText(url, { fetchImpl = fetch, timeoutMs = 12000, headers = {} } = {}) {
  const res = await fetchImpl(url, {
    headers: { ...UA_HEADERS, ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await res.text()
  return { ok: res.ok, status: res.status, contentType: res.headers.get('content-type') || '', body }
}

function okSearch(query, results, source, maxResults) {
  const rows = capResults(results, maxResults)
  return { source, results: rows, text: formatResults(query, rows, source) }
}

async function tryBrave(query, { fetchImpl, apiKey, maxResults }) {
  if (!apiKey) return null
  const target = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`
  const got = await fetchText(target, {
    fetchImpl,
    timeoutMs: 8000,
    headers: { accept: 'application/json', 'x-subscription-token': apiKey },
  })
  if (!got.ok) return null
  const results = parseBraveWeb(got.body)
  if (!results.length) return null
  return okSearch(query, results, 'brave', maxResults)
}

async function tryDuckDuckGoHtml(query, { fetchImpl, maxResults }) {
  const ddg = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const got = await fetchText(ddg, { fetchImpl })
  if (isRateLimitedStatus(got.status)) return null
  const results = parseDdgHtml(got.body)
  if (!results.length) return null
  return okSearch(query, results, 'duckduckgo', maxResults)
}

async function tryDuckDuckGoInstant(query, { fetchImpl, maxResults }) {
  const target = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
  const got = await fetchText(target, { fetchImpl, timeoutMs: 8000, headers: { accept: 'application/json' } })
  if (!got.ok) return null
  const results = parseDdgInstant(got.body)
  if (!results.length) return null
  return okSearch(query, results, 'duckduckgo', maxResults)
}

async function tryWikipedia(query, { fetchImpl, maxResults }) {
  const target = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=8&namespace=0&format=json`
  const got = await fetchText(target, { fetchImpl, timeoutMs: 8000, headers: { accept: 'application/json' } })
  if (!got.ok) return null
  const results = parseWikipediaOpensearch(got.body)
  if (!results.length) return null
  return okSearch(query, results, 'wikipedia', maxResults)
}

export async function searchWeb(query, {
  searxUrls,
  fetchImpl = fetch,
  maxResults,
  cooldown = defaultCooldown,
  random = Math.random,
  braveKey = process.env.BRAVE_API_KEY,
} = {}) {
  const q = String(query || '').trim()
  if (!q) return { source: 'none', results: [], text: 'Missing query.' }

  const brave = await tryBrave(q, { fetchImpl, apiKey: braveKey, maxResults }).catch(() => null)
  if (brave) return brave

  const urls = shuffle(splitSearxUrls(searxUrls ?? process.env.SEARXNG_URL), random)
  let searxAttempts = 0
  for (const base of urls) {
    if (cooldown?.isCool?.(base)) continue
    if (searxAttempts >= MAX_SEARX_ATTEMPTS) break
    searxAttempts += 1
    const target = `${base.replace(/\/$/, '')}/search?q=${encodeURIComponent(q)}&format=json&language=all`
    try {
      const got = await fetchText(target, { fetchImpl, timeoutMs: 5000, headers: { accept: 'application/json' } })
      if (!got.ok) {
        cooldown?.mark?.(base, got.status)
        if (isRateLimitedStatus(got.status)) continue
        continue
      }
      const results = parseSearxJson(got.body)
      if (results.length) return okSearch(q, results, `searxng ${hostKey(base)}`, maxResults)
    } catch {
      continue
    }
  }

  const ddgHtml = await tryDuckDuckGoHtml(q, { fetchImpl, maxResults }).catch(() => null)
  if (ddgHtml) return ddgHtml

  const ddgInstant = await tryDuckDuckGoInstant(q, { fetchImpl, maxResults }).catch(() => null)
  if (ddgInstant) return ddgInstant

  const wiki = await tryWikipedia(q, { fetchImpl, maxResults }).catch(() => null)
  if (wiki) return wiki

  return {
    source: 'none',
    results: [],
    text: `Search is temporarily unavailable for ${q}. Public search endpoints are busy; retry with a narrower query.`,
  }
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
  if (isRateLimitedStatus(got.status)) {
    return `Could not fetch ${target}: the site is temporarily refusing requests. Try again later.`
  }
  const text = htmlToText(got.body).slice(0, maxChars)
  return `HTTP ${got.status} ${target}\n\n${text || '(empty body)'}`
}
