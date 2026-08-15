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
    <div class="result__body">
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2Fsearxng%2Fsearxng&amp;rut=abc">GitHub - searxng/searxng</a>
      <a class="result__snippet" href="#">Privacy-respecting metasearch</a>
    </div>
    <div class="result__body">
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fdocs.searxng.org%2F">Docs</a>
    </div>
  `
  const rows = parseDdgHtml(html)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].url, 'https://github.com/searxng/searxng')
  assert.equal(rows[0].engine, 'duckduckgo')
  assert.match(rows[0].snippet, /metasearch/)
})

test('splitSearxUrls falls back to defaults', () => {
  assert.ok(splitSearxUrls('').includes('https://priv.au'))
  assert.deepEqual(splitSearxUrls('https://a.example;https://b.example/'), ['https://a.example', 'https://b.example'])
})

test('searchWeb uses SearXNG json after DuckDuckGo is empty', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('format=json')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({
          results: [{ title: 'Harbor Kiln', url: 'https://example.com/store', content: 'independent store' }],
        }),
      }
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      text: async () => '<html></html>',
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

test('searchWeb uses DuckDuckGo before public SearXNG', async () => {
  const seen = []
  const fetchImpl = async (url) => {
    seen.push(String(url))
    if (String(url).includes('duckduckgo.com/html')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        text: async () => '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">Example</a><a class="result__snippet"> Housewares importer</a>',
      }
    }
    return { ok: false, status: 429, headers: { get: () => 'text/plain' }, text: async () => 'Too Many Requests' }
  }
  const out = await searchWeb('example', {
    searxUrls: 'https://searx.example',
    fetchImpl,
    braveKey: '',
    cooldown: createMemoryCooldown(),
  })
  assert.equal(out.source, 'duckduckgo')
  assert.equal(out.results[0].url, 'https://example.com/page')
  assert.match(out.results[0].snippet, /Housewares/)
  assert.ok(seen.some((url) => url.includes('duckduckgo')))
  assert.ok(seen.every((url) => !url.includes('searx.example')))
  assert.doesNotMatch(out.text, /\b429\b/)
})

test('searchWeb skips SearXNG when no URL is configured', async () => {
  const prevPublic = process.env.SEARXNG_PUBLIC
  delete process.env.SEARXNG_PUBLIC
  const seen = []
  const fetchImpl = async (url) => {
    seen.push(String(url))
    if (String(url).includes('duckduckgo.com/html')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        text: async () => '<a class="result__a" href="https://example.com/a">A</a>',
      }
    }
    throw new Error(`unexpected ${url}`)
  }
  try {
    const out = await searchWeb('example', {
      searxUrls: '',
      fetchImpl,
      braveKey: '',
      cooldown: createMemoryCooldown(),
    })
    assert.equal(out.source, 'duckduckgo')
    assert.ok(seen.every((url) => !/searx|tiekoetter|priv\.au/.test(url)))
  } finally {
    if (prevPublic !== undefined) process.env.SEARXNG_PUBLIC = prevPublic
  }
})

test('searchWeb does not hit public SearXNG unless opted in', async () => {
  const prevPublic = process.env.SEARXNG_PUBLIC
  const prevUrl = process.env.SEARXNG_URL
  delete process.env.SEARXNG_PUBLIC
  delete process.env.SEARXNG_URL
  const seen = []
  const fetchImpl = async (url) => {
    seen.push(String(url))
    if (String(url).includes('wikipedia')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(['q', ['Alpha'], ['note'], ['https://en.wikipedia.org/wiki/Alpha']]),
      }
    }
    return { ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => '<html></html>' }
  }
  try {
    const out = await searchWeb('example', {
      fetchImpl,
      braveKey: '',
      cooldown: createMemoryCooldown(),
    })
    assert.equal(out.source, 'wikipedia')
    assert.ok(seen.every((url) => !/searx|tiekoetter|priv\.au|ononoki|opnxng|paulgo/.test(url)))
  } finally {
    if (prevPublic !== undefined) process.env.SEARXNG_PUBLIC = prevPublic
    else delete process.env.SEARXNG_PUBLIC
    if (prevUrl !== undefined) process.env.SEARXNG_URL = prevUrl
    else delete process.env.SEARXNG_URL
  }
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
