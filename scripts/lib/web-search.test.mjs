import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseDdgHtml,
  parseSearxJson,
  parseWikipediaOpensearch,
  searchWeb,
  htmlToText,
  splitSearxUrls,
  sanitizeSearchNoise,
  createMemoryCooldown,
  fetchPage,
} from './web-search.mjs'

test('parses SearXNG json results', () => {
  const rows = parseSearxJson({
    results: [
      { title: 'SearXNG', url: 'https://github.com/searxng/searxng', content: 'metasearch' },
      { title: '', url: '' },
    ],
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].engine, 'searxng')
  assert.match(rows[0].url, /searxng/)
})

test('parses DuckDuckGo html redirect links', () => {
  const html = `
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2Fsearxng%2Fsearxng&amp;rut=abc">GitHub - searxng/searxng</a>
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fdocs.searxng.org%2F">Docs</a>
  `
  const rows = parseDdgHtml(html)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].url, 'https://github.com/searxng/searxng')
  assert.equal(rows[0].engine, 'duckduckgo')
})

test('splitSearxUrls falls back to defaults', () => {
  assert.ok(splitSearxUrls('').includes('https://priv.au'))
  assert.deepEqual(splitSearxUrls('https://a.example;https://b.example/'), ['https://a.example', 'https://b.example'])
})

test('searchWeb uses SearXNG json when it works', async () => {
  const fetchImpl = async (url) => {
    assert.match(String(url), /format=json/)
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({
        results: [{ title: 'Harbor Kiln', url: 'https://example.com/store', content: 'independent store' }],
      }),
    }
  }
  const out = await searchWeb('ecommerce storefront', {
    searxUrls: 'https://searx.example',
    fetchImpl,
    braveKey: '',
    cooldown: createMemoryCooldown(),
  })
  assert.equal(out.source, 'searxng searx.example')
  assert.equal(out.results[0].title, 'Harbor Kiln')
  assert.match(out.text, /Harbor Kiln/)
  assert.doesNotMatch(out.text, /\b429\b/)
})

test('searchWeb falls back to DuckDuckGo when SearXNG fails', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('searx')) {
      return { ok: false, status: 429, headers: { get: () => 'text/plain' }, text: async () => 'Too Many Requests' }
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      text: async () => '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">Example</a>',
    }
  }
  const out = await searchWeb('example', {
    searxUrls: 'https://searx.example',
    fetchImpl,
    braveKey: '',
    cooldown: createMemoryCooldown(),
  })
  assert.equal(out.source, 'duckduckgo')
  assert.equal(out.results[0].url, 'https://example.com/page')
  assert.match(out.text, /Source: duckduckgo/)
  assert.doesNotMatch(out.text, /\b429\b/)
  assert.doesNotMatch(out.text, /searxng failed/i)
})

test('sanitizeSearchNoise strips status codes from leaked errors', () => {
  assert.doesNotMatch(
    sanitizeSearchNoise('searxng failed: https://priv.au HTTP 429; too many requests'),
    /\b429\b/,
  )
})

test('searchWeb falls back to Wikipedia without leaking 429', async () => {
  const fetchImpl = async (url) => {
    const href = String(url)
    if (href.includes('searx') || href.includes('duckduckgo')) {
      return { ok: false, status: 429, headers: { get: () => 'text/plain' }, text: async () => 'Too Many Requests' }
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify(['Kitchenlab', ['Kitchenlab AB'], ['Swedish housewares'], ['https://en.wikipedia.org/wiki/Kitchenlab']]),
    }
  }
  const out = await searchWeb('Kitchenlab AB', {
    searxUrls: 'https://searx.example',
    fetchImpl,
    braveKey: '',
    cooldown: createMemoryCooldown(),
  })
  assert.equal(out.source, 'wikipedia')
  assert.equal(out.results[0].url, 'https://en.wikipedia.org/wiki/Kitchenlab')
  assert.doesNotMatch(out.text, /\b429\b/)
})

test('cooled-down SearXNG hosts are skipped', async () => {
  const seen = []
  const cooldown = createMemoryCooldown({ now: () => 1_000 })
  cooldown.mark('https://hot.example', 429)
  const fetchImpl = async (url) => {
    seen.push(String(url))
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({
        results: [{ title: 'Cold', url: 'https://example.com/cold', content: 'ok' }],
      }),
    }
  }
  const out = await searchWeb('cold', {
    searxUrls: 'https://hot.example;https://cold.example',
    fetchImpl,
    braveKey: '',
    cooldown,
    random: () => 0,
  })
  assert.ok(seen.every((url) => !url.includes('hot.example')))
  assert.equal(out.source, 'searxng cold.example')
})

test('parseWikipediaOpensearch maps titles and urls', () => {
  const rows = parseWikipediaOpensearch(['q', ['Alpha'], ['note'], ['https://en.wikipedia.org/wiki/Alpha']])
  assert.equal(rows[0].engine, 'wikipedia')
  assert.equal(rows[0].url, 'https://en.wikipedia.org/wiki/Alpha')
})

test('fetchPage does not surface HTTP 429', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 429,
    headers: { get: () => 'text/plain' },
    text: async () => 'Too Many Requests',
  })
  const text = await fetchPage('https://example.com/busy', { fetchImpl })
  assert.match(text, /temporarily refusing/)
  assert.doesNotMatch(text, /\b429\b/)
})

test('htmlToText strips scripts', () => {
  assert.equal(htmlToText('<script>secret()</script><p>Hello &amp; hi</p>'), 'Hello & hi')
})
