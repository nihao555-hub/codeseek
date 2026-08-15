import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseOpenWebSearchJson, formatOpenWebSearch } from './open-websearch.mjs'

test('parseOpenWebSearchJson reads CLI envelope results', () => {
  const rows = parseOpenWebSearchJson(JSON.stringify({
    status: 'ok',
    data: {
      results: [
        { title: 'KitchenLab', url: 'https://www.kitchenlab.se/', description: 'Swedish housewares', engine: 'duckduckgo' },
        { title: '', url: '' },
      ],
    },
    error: null,
  }))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].url, 'https://www.kitchenlab.se/')
  assert.match(rows[0].snippet, /housewares/i)
})

test('formatOpenWebSearch lists titles and urls for the Search card', () => {
  const text = formatOpenWebSearch('Kitchenlab AB', [
    { title: 'KitchenLab', url: 'https://www.kitchenlab.se/', snippet: 'Cookware' },
  ], 'open-websearch duckduckgo')
  assert.match(text, /Search: Kitchenlab AB/)
  assert.match(text, /kitchenlab\.se/)
  assert.doesNotMatch(text, /\b429\b/)
})

test('parseOpenWebSearchJson also accepts a bare result array', () => {
  const rows = parseOpenWebSearchJson(JSON.stringify([
    { title: 'KitchenLab', url: 'https://www.kitchenlab.se/', snippet: 'Housewares' },
  ]))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].url, 'https://www.kitchenlab.se/')
})

test('parseOpenWebSearchJson throws a clean error without HTTP status noise', () => {
  assert.throws(
    () => parseOpenWebSearchJson(JSON.stringify({
      status: 'error',
      error: { message: 'engine busy' },
    })),
    /engine busy/,
  )
})
