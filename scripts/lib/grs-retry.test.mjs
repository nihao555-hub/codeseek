import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isRetryableGrsFailure,
  parseRetryAfter,
  retryDelayMs,
  runWithRetries,
} from './grs-retry.mjs'

test('retries GRS model-load 400', () => {
  const body = '{"message":"The model load is too high, please try again later","type":"rix_api_error"}'
  assert.equal(isRetryableGrsFailure({ status: 400, bodyText: body }), true)
})

test('does not retry ordinary 400', () => {
  assert.equal(isRetryableGrsFailure({ status: 400, bodyText: '{"message":"invalid model"}' }), false)
})

test('retries 429, 503 and timeouts', () => {
  assert.equal(isRetryableGrsFailure({ status: 429, bodyText: '' }), true)
  assert.equal(isRetryableGrsFailure({ status: 503, bodyText: 'busy' }), true)
  assert.equal(isRetryableGrsFailure({ error: new Error('TimeoutError: The operation was aborted due to timeout') }), true)
})

test('backoff doubles then caps', () => {
  assert.equal(retryDelayMs(0), 1000)
  assert.equal(retryDelayMs(1), 2000)
  assert.equal(retryDelayMs(2), 4000)
  assert.equal(retryDelayMs(3), 8000)
  assert.equal(retryDelayMs(8), 8000)
})

test('429 uses Retry-After and a longer floor', () => {
  assert.equal(retryDelayMs(0, { status: 429 }), 2000)
  assert.equal(retryDelayMs(0, { status: 429, retryAfterMs: 3500 }), 3500)
  assert.equal(retryDelayMs(0, { status: 429, retryAfterMs: 20_000, maxDelayMs: 8000 }), 8000)
})

test('parseRetryAfter reads seconds and HTTP dates', () => {
  assert.equal(parseRetryAfter('2'), 2000)
  assert.equal(parseRetryAfter('1.5'), 1500)
  const now = Date.parse('Wed, 21 Oct 2015 07:28:00 GMT')
  assert.equal(parseRetryAfter('Wed, 21 Oct 2015 07:28:05 GMT', now), 5000)
  assert.equal(parseRetryAfter('nope'), undefined)
})

test('runWithRetries tries first success once', async () => {
  let n = 0
  const out = await runWithRetries(async () => {
    n += 1
    return { retry: false, value: 'ok' }
  }, { sleep: async () => {} })
  assert.equal(n, 1)
  assert.equal(out.value, 'ok')
})

test('runWithRetries retries three times then succeeds (4 attempts max)', async () => {
  let n = 0
  const delays = []
  const out = await runWithRetries(async () => {
    n += 1
    if (n < 4) return { retry: true, reason: 'load' }
    return { retry: false, value: 'ok' }
  }, {
    maxRetries: 3,
    sleep: async (ms) => { delays.push(ms) },
  })
  assert.equal(n, 4)
  assert.equal(out.value, 'ok')
  assert.deepEqual(delays, [1000, 2000, 4000])
})

test('runWithRetries stops after maxRetries failures', async () => {
  let n = 0
  const out = await runWithRetries(async () => {
    n += 1
    return { retry: true, reason: 'load', status: 400 }
  }, { maxRetries: 3, sleep: async () => {} })
  assert.equal(n, 4)
  assert.equal(out.retry, true)
  assert.equal(out.status, 400)
})

test('runWithRetries honors 429 Retry-After', async () => {
  const delays = []
  await runWithRetries(async () => ({ retry: true, reason: '429', status: 429, retryAfterMs: 2500 }), {
    maxRetries: 2,
    maxDelayMs: 15_000,
    sleep: async (ms) => { delays.push(ms) },
  })
  assert.deepEqual(delays, [2500, 4000])
})
