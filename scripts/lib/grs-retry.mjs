/**
 * GRS 上游瞬时失败重试：负载过高、限流、5xx、超时与网络错误。
 * maxRetries 表示失败后再试的次数（默认 3，合计最多 4 次请求）。
 */

export const DEFAULT_MAX_RETRIES = 3
export const DEFAULT_INITIAL_DELAY_MS = 1000
export const DEFAULT_MAX_DELAY_MS = 8000
export const DEFAULT_RATE_LIMIT_INITIAL_DELAY_MS = 2000

const TRANSIENT_BODY = /model load is too high|try again later|rix_api_error|rlx_api_error|overloaded|overloaded_error|capacity|rate.?limit|too many requests|busy|timeout|temporar(?:y|ily)|server.?busy|please retry/i
const TRANSIENT_NET = /timeout|timed out|network|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|terminated|fetch failed|UND_ERR|socket|other side closed|premature close|aborted/i

/**
 * @param {{ status?: number, bodyText?: string, error?: unknown }} input
 */
export function isRetryableGrsFailure({ status, bodyText = '', error } = {}) {
  if (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (TRANSIENT_NET.test(msg)) return true
  }
  if (status === 429 || (typeof status === 'number' && status >= 500)) return true
  if (status === 400 || status === 408 || status === 409 || status === 423) {
    return TRANSIENT_BODY.test(String(bodyText))
  }
  return false
}

export function parseRetryAfter(value, now = Date.now()) {
  if (value == null || value === '') return undefined
  const text = String(value).trim()
  if (/^\d+(\.\d+)?$/.test(text)) return Math.max(0, Number(text) * 1000)
  const date = Date.parse(text)
  if (Number.isNaN(date)) return undefined
  return Math.max(0, date - now)
}

export function retryDelayMs(retryIndex, {
  initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
  retryAfterMs,
  status,
} = {}) {
  const exponent = Math.min(Math.max(retryIndex, 0), 10)
  const start = status === 429
    ? Math.max(initialDelayMs, DEFAULT_RATE_LIMIT_INITIAL_DELAY_MS)
    : initialDelayMs
  let delay = start * 2 ** exponent
  if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    delay = Math.max(delay, retryAfterMs)
  }
  return Math.min(delay, maxDelayMs)
}

/**
 * @template T
 * @param {(attempt: number) => Promise<{ retry: boolean, reason?: string } & T>} task
 * @param {{ maxRetries?: number, sleep?: (ms: number) => Promise<void>, onRetry?: (info: { attempt: number, maxRetries: number, delay: number, reason?: string }) => void }} [options]
 */
export async function runWithRetries(task, {
  maxRetries = DEFAULT_MAX_RETRIES,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  onRetry,
  initialDelayMs,
  maxDelayMs,
} = {}) {
  let last
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    last = await task(attempt)
    if (!last.retry) return last
    if (attempt === maxRetries) return last
    const delay = retryDelayMs(attempt, {
      initialDelayMs,
      maxDelayMs,
      retryAfterMs: last.retryAfterMs,
      status: last.status,
    })
    onRetry?.({ attempt: attempt + 1, maxRetries, delay, reason: last.reason })
    await sleep(delay)
  }
  return last
}
