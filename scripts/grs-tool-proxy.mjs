#!/usr/bin/env node
/**
 * 本地 OpenAI 兼容代理：把 GRS 不支持的 native tools 转成文本协议，再还原 tool_calls。
 * 仅监听回环地址。密钥从请求 Authorization 原样转发，不写日志。
 */
import http from 'node:http'
import {
  applyReasoningModelCompat,
  buildClientResponse,
  bumpReasoningBudget,
  collectCompletion,
  encodeAssistantContent,
  EMPTY_COMPLETION_FALLBACK,
  isEmptyAssistant,
  nudgeEmptyRetry,
  nudgeToolSkipRetry,
  parseAssistantToolPayload,
  shouldRetryMissingToolCalls,
  sseEncode,
  toUpstreamChatBody,
  withLiftedReasoning,
} from './lib/grs-tool-protocol.mjs'
import { isRetryableGrsFailure, retryDelayMs, runWithRetries } from './lib/grs-retry.mjs'

const host = process.env.GRS_TOOL_PROXY_HOST || '127.0.0.1'
const port = Number(process.env.GRS_TOOL_PROXY_PORT || 18765)
const upstreamBase = (process.env.GRS_UPSTREAM_BASE_URL || process.env.GRS_BASE_URL || 'https://grsaiapi.com/v1').replace(/\/$/, '')
const passthrough = process.env.GRS_TOOL_PROXY_PASSTHROUGH === '1'
const timeoutMs = Number(process.env.GRS_TOOL_PROXY_TIMEOUT_MS || 300_000)
const maxRetries = Number(process.env.GRS_TOOL_PROXY_MAX_RETRIES || 3)
const emptyRetries = Number(process.env.GRS_EMPTY_COMPLETION_RETRIES || 2)
const toolSkipRetries = Number(process.env.GRS_TOOL_SKIP_RETRIES || 1)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function log(message) {
  const stamp = new Date().toISOString()
  process.stderr.write(`[grs-tool-proxy ${stamp}] ${message}\n`)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function send(res, status, headers, body) {
  res.writeHead(status, headers)
  res.end(body)
}

async function fetchUpstream(url, init) {
  return runWithRetries(async () => {
    try {
      const upstream = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      })
      const buf = Buffer.from(await upstream.arrayBuffer())
      const bodyText = buf.toString('utf8').slice(0, 4000)
      if (!upstream.ok && isRetryableGrsFailure({ status: upstream.status, bodyText })) {
        return {
          retry: true,
          reason: `${upstream.status} ${bodyText.replace(/\s+/g, ' ').slice(0, 160)}`,
          status: upstream.status,
          buf,
          contentType: upstream.headers.get('content-type') || 'application/json',
        }
      }
      return {
        retry: false,
        status: upstream.status,
        buf,
        contentType: upstream.headers.get('content-type') || 'application/json',
      }
    } catch (error) {
      if (isRetryableGrsFailure({ error })) {
        return {
          retry: true,
          reason: error instanceof Error ? error.message : String(error),
          error,
        }
      }
      throw error
    }
  }, {
    maxRetries,
    onRetry: ({ attempt, maxRetries: max, delay, reason }) => {
      log(`retry ${attempt}/${max} in ${delay}ms: ${reason}`)
    },
  })
}

async function proxyRaw(req, rawBody, res) {
  const path = (req.url || '/').replace(/^\/v1(?=\/|$)/, '') || '/'
  const target = `${upstreamBase}${path}`
  const result = await fetchUpstream(target, {
    method: req.method,
    headers: {
      authorization: req.headers.authorization || '',
      'content-type': req.headers['content-type'] || 'application/json',
      accept: req.headers.accept || 'application/json',
    },
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : rawBody,
  })
  if (result.error && !result.buf) {
    send(res, 502, { 'content-type': 'application/json' }, JSON.stringify({ error: { message: result.reason || 'upstream failed' } }))
    return
  }
  send(res, result.status || 502, { 'content-type': result.contentType || 'application/json' }, result.buf)
}

function respondChat(res, stream, body) {
  const headers = {
    'content-type': stream ? 'text/event-stream; charset=utf-8' : 'application/json',
  }
  if (stream) headers['cache-control'] = 'no-cache'
  send(res, 200, headers, body)
}

async function postChat(req, payload, stream) {
  return fetchUpstream(`${upstreamBase}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: req.headers.authorization || '',
      'content-type': 'application/json',
      accept: stream ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

async function handleChat(req, rawBody, res) {
  let body
  try {
    body = JSON.parse(rawBody.toString('utf8') || '{}')
  } catch {
    send(res, 400, { 'content-type': 'application/json' }, JSON.stringify({ error: { message: 'invalid json' } }))
    return
  }

  const stream = body.stream !== false
  const hasTools = Array.isArray(body.tools) && body.tools.length > 0
  const rewrite = hasTools && !passthrough
  let payload = applyReasoningModelCompat(rewrite ? toUpstreamChatBody(body) : { ...body })
  payload = { ...payload, stream }
  log(`${body.model || '?'} tools=${hasTools ? body.tools.length : 0} rewrite=${rewrite} stream=${stream}`)

  let result
  let collected
  let raw
  for (let attempt = 0; attempt <= emptyRetries; attempt++) {
    if (attempt > 0) {
      const delay = retryDelayMs(attempt - 1)
      log(`empty completion retry ${attempt}/${emptyRetries} in ${delay}ms (${body.model || '?'})`)
      await sleep(delay)
      payload = bumpReasoningBudget(nudgeEmptyRetry(payload))
    }
    result = await postChat(req, payload, stream)
    if (result.error && !result.buf) {
      send(res, 502, { 'content-type': 'application/json' }, JSON.stringify({ error: { message: result.reason || 'upstream failed' } }))
      return
    }
    raw = result.buf
    if (!raw || result.status !== 200) {
      send(res, result.status || 502, { 'content-type': result.contentType || 'application/json' }, raw || Buffer.from(JSON.stringify({ error: { message: result.reason || 'upstream failed' } })))
      return
    }
    try {
      collected = withLiftedReasoning(collectCompletion(raw.toString('utf8'), stream))
    } catch (err) {
      log(`collect failed: ${err instanceof Error ? err.message : err}`)
      send(res, 502, { 'content-type': 'application/json' }, JSON.stringify({ error: { message: 'upstream parse failed' } }))
      return
    }
    const parsedProbe = parseAssistantToolPayload(collected.content)
    if (!isEmptyAssistant(collected) || parsedProbe.calls.length > 0) break
    if (attempt === emptyRetries) {
      log(`empty completion after ${attempt + 1} tries; injecting fallback`)
      collected = { ...collected, content: EMPTY_COMPLETION_FALLBACK, lifted: true }
    }
  }

  let parsed = parseAssistantToolPayload(collected.content)
  for (let skip = 0; skip < toolSkipRetries; skip++) {
    if (!shouldRetryMissingToolCalls({
      rewrite,
      messages: body.messages,
      calls: parsed.calls,
      content: collected.content,
    })) break
    const delay = retryDelayMs(skip)
    log(`missing tool_call retry ${skip + 1}/${toolSkipRetries} in ${delay}ms (${body.model || '?'})`)
    await sleep(delay)
    payload = bumpReasoningBudget(nudgeToolSkipRetry(payload))
    result = await postChat(req, payload, stream)
    if (result.error && !result.buf) {
      send(res, 502, { 'content-type': 'application/json' }, JSON.stringify({ error: { message: result.reason || 'upstream failed' } }))
      return
    }
    raw = result.buf
    if (!raw || result.status !== 200) {
      send(res, result.status || 502, { 'content-type': result.contentType || 'application/json' }, raw || Buffer.from(JSON.stringify({ error: { message: result.reason || 'upstream failed' } })))
      return
    }
    try {
      collected = withLiftedReasoning(collectCompletion(raw.toString('utf8'), stream))
    } catch (err) {
      log(`collect failed: ${err instanceof Error ? err.message : err}`)
      send(res, 502, { 'content-type': 'application/json' }, JSON.stringify({ error: { message: 'upstream parse failed' } }))
      return
    }
    parsed = parseAssistantToolPayload(collected.content)
  }

  if (collected.nativeToolCalls && !collected.lifted) {
    respondChat(res, stream, raw)
    return
  }

  if (parsed.calls.length > 0 && rewrite) {
    log(`parsed ${parsed.calls.length} tool call(s): ${parsed.calls.map((c) => c.name).join(',')}`)
    const rewritten = buildClientResponse({
      stream,
      upstream: collected.data || {},
      content: parsed.text,
      calls: parsed.calls,
    })
    respondChat(res, stream, stream ? sseEncode(rewritten) : JSON.stringify(rewritten))
    return
  }

  if (parsed.calls.length === 0 && /tool_call|<\/invoke>|"name"\s*:/.test(collected.content)) {
    log(`no tool calls parsed from tool-shaped text: ${collected.content.replace(/\s+/g, ' ').trim().slice(0, 240)}`)
  }

  if (collected.lifted || isEmptyAssistant(collected)) {
    log(`rewriting ${collected.lifted ? 'reasoning' : 'empty'} completion as visible content (${String(collected.content).length} chars)`)
    respondChat(res, stream, encodeAssistantContent({
      stream,
      upstream: collected.data || {},
      content: collected.content || EMPTY_COMPLETION_FALLBACK,
      finishReason: collected.finishReason || 'stop',
    }))
    return
  }

  respondChat(res, stream, raw)
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/health' || req.url === '/v1/health') {
      send(res, 200, { 'content-type': 'application/json' }, JSON.stringify({ ok: true, upstream: upstreamBase }))
      return
    }
    const rawBody = req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : await readBody(req)
    if (req.method === 'POST' && (req.url === '/v1/chat/completions' || req.url === '/chat/completions')) {
      await handleChat(req, rawBody, res)
      return
    }
    await proxyRaw(req, rawBody, res)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log(`error ${message}`)
    if (!res.headersSent) {
      send(res, 502, { 'content-type': 'application/json' }, JSON.stringify({ error: { message } }))
    }
  }
})

server.listen(port, host, () => {
  log(`listening on http://${host}:${port} -> ${upstreamBase} (maxRetries=${maxRetries} emptyRetries=${emptyRetries})`)
})
