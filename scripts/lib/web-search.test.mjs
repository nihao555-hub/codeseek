import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDdgHtml, parseSearxJson, searchWeb, htmlToText, splitSearxUrls } from './web-search.mjs'

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
  const out = await searchWeb('ecommerce storefront', { searxUrls: 'https://searx.example', fetchImpl })
  assert.equal(out.source, 'searxng:https://searx.example')
  assert.equal(out.results[0].title, 'Harbor Kiln')
  assert.match(out.text, /Harbor Kiln/)
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
  const out = await searchWeb('example', { searxUrls: 'https://searx.example', fetchImpl })
  assert.equal(out.source, 'duckduckgo')
  assert.equal(out.results[0].url, 'https://example.com/page')
  assert.match(out.text, /duckduckgo html/)
})

test('htmlToText strips scripts', () => {
  assert.equal(htmlToText('<script>secret()</script><p>Hello &amp; hi</p>'), 'Hello & hi')
})
