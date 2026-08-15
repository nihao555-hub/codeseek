/**
 * Aas-ee/open-webSearch CLI JSON → 给模型看的搜索结果。
 * CLI `--json` 信封是 `{status,data.results,error}`；也接受裸数组。
 */

function mapRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    title: String(row.title || row.url || '').trim(),
    url: String(row.url || '').trim(),
    snippet: String(row.description || row.snippet || '').trim(),
    engine: String(row.engine || row.source || 'open-websearch').trim(),
  })).filter((row) => row.url)
}

export function parseOpenWebSearchJson(raw) {
  const text = String(raw || '').trim()
  const objStart = text.indexOf('{')
  const arrStart = text.indexOf('[')
  const start = objStart >= 0 && (arrStart < 0 || objStart < arrStart) ? objStart : arrStart
  const payload = start >= 0 ? text.slice(start) : text
  const data = JSON.parse(payload || '{}')
  if (Array.isArray(data)) return mapRows(data)
  if (data.status === 'error' || data.ok === false) {
    const message = data.error?.message || 'open-websearch failed'
    throw new Error(message)
  }
  return mapRows(data.data?.results || data.results || [])
}

export function formatOpenWebSearch(query, rows, source = 'open-websearch') {
  if (!rows.length) return `No results for ${query} (tried ${source}).`
  const lines = [`Search: ${query}`, `Source: ${source}`, '']
  for (const [i, row] of rows.entries()) {
    lines.push(`${i + 1}. ${row.title}`)
    lines.push(`   ${row.url}`)
    if (row.snippet) lines.push(`   ${row.snippet.replace(/\s+/g, ' ').slice(0, 280)}`)
  }
  return lines.join('\n')
}
