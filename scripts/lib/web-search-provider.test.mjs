import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CODESEEK_SEARCH_PROVIDER_ID, createCodeseekSearchProvider, apply } from '../web-search-provider.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('codeseek search provider maps SearXNG results into the official web seam', async () => {
  const provider = createCodeseekSearchProvider({
    search: async (query) => ({
      source: 'searxng:https://example.test',
      results: [{ title: 'SearXNG', url: 'https://github.com/searxng/searxng', snippet: 'metasearch' }],
      text: `Search: ${query}`,
    }),
  })
  assert.equal(provider.id, CODESEEK_SEARCH_PROVIDER_ID)
  assert.equal(provider.available(), true)
  const result = await provider.search({ query: 'searxng github' })
  assert.match(result.content, /Found 1 results/)
  assert.match(result.content, /searxng github/)
  assert.equal(result.sources[0].url, 'https://github.com/searxng/searxng')
  assert.equal(result.sources[0].title, 'SearXNG')
  assert.equal(result.sources[0].snippet, 'metasearch')
})

test('cordis apply registers the provider on ctx.web', () => {
  const registered = []
  apply({ web: { registerSearchProvider: (provider) => registered.push(provider) } })
  assert.equal(registered[0].id, CODESEEK_SEARCH_PROVIDER_ID)
})

test('home patch points official web_search at the local provider', () => {
  const home = readFileSync(join(root, 'dsh-home/cordis.patch.yml'), 'utf8')
  assert.match(home, /searchProvider: codeseek-searxng/)
  assert.match(home, /- id: web-search-deepseek\n  disabled: true/)
  const mcp = readFileSync(join(root, 'dsh-home/cordis.mcp.patch.yml'), 'utf8')
  assert.match(mcp, /id: web-search-codeseek/)
  assert.match(mcp, /scripts\/web-search-provider\.mjs/)
  assert.match(mcp, /id: mcp-open-websearch/)
  assert.match(mcp, /open-websearch-mcp\.mjs/)
})
