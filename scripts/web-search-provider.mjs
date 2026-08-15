/**
 * Cordis 插件：把官方模型可见工具 web_search 接到本地 SearXNG / DuckDuckGo。
 * 不改 vendor；由 dsh-home/cordis.patch.yml 插入，searchProvider 钉成 codeseek-searxng。
 */
import { searchWeb } from './lib/web-search.mjs'

export const name = 'web-search-codeseek'
export const inject = ['web']
export const CODESEEK_SEARCH_PROVIDER_ID = 'codeseek-searxng'

export function createCodeseekSearchProvider({ search = searchWeb } = {}) {
  return {
    id: CODESEEK_SEARCH_PROVIDER_ID,
    available() {
      return true
    },
    async search(request) {
      const query = String(request?.query || '').trim()
      const out = await search(query, {
        maxResults: request?.maxResults,
      })
      const cap = Number.isInteger(request?.maxResults) && request.maxResults > 0
        ? request.maxResults
        : undefined
      const rows = cap ? (out.results || []).slice(0, cap) : (out.results || [])
      const sources = rows.map((row) => ({
        url: row.url,
        ...row.title ? { title: row.title } : {},
        ...row.snippet ? { snippet: row.snippet } : {},
      }))
      return {
        content: out.text,
        sources,
        truncated: Boolean(cap && (out.results || []).length > cap),
      }
    },
  }
}

export function apply(ctx) {
  ctx.web.registerSearchProvider(createCodeseekSearchProvider())
}
