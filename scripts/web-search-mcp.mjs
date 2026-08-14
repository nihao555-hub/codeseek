#!/usr/bin/env node
/**
 * 本地 stdio MCP：SearXNG 开源元搜索，失败则 DuckDuckGo HTML。
 * 由 toolkit/catalog.json 的 web-search 条目启动，不要手动当 HTTP 服务。
 */
import { searchWeb, fetchPage } from './lib/web-search.mjs'

const TOOLS = [
  {
    name: 'web_search',
    description: 'Search the public web. Tries open-source SearXNG first, then DuckDuckGo HTML if public instances fail.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch a public HTTP(S) URL and return readable text.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'http or https URL' },
      },
      required: ['url'],
    },
  },
]

function writeMessage(message) {
  const json = JSON.stringify(message)
  const payload = Buffer.from(json, 'utf8')
  process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`)
  process.stdout.write(payload)
}

function reply(id, result) {
  writeMessage({ jsonrpc: '2.0', id, result })
}

function fail(id, message) {
  writeMessage({ jsonrpc: '2.0', id, error: { code: -32000, message } })
}

async function handle(message) {
  if (!message || typeof message !== 'object') return
  const { id, method, params } = message
  if (method === 'initialize') {
    reply(id, {
      protocolVersion: params?.protocolVersion || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'web-search', version: '1.0.0' },
    })
    return
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return
  if (method === 'ping') {
    reply(id, {})
    return
  }
  if (method === 'tools/list') {
    reply(id, { tools: TOOLS })
    return
  }
  if (method === 'tools/call') {
    const name = params?.name
    const args = params?.arguments || {}
    try {
      if (name === 'web_search') {
        const out = await searchWeb(args.query)
        reply(id, { content: [{ type: 'text', text: out.text }] })
        return
      }
      if (name === 'web_fetch') {
        const text = await fetchPage(args.url)
        reply(id, { content: [{ type: 'text', text }] })
        return
      }
      fail(id, `Unknown tool: ${name}`)
    } catch (error) {
      fail(id, error instanceof Error ? error.message : String(error))
    }
    return
  }
  if (id != null) fail(id, `Unknown method: ${method}`)
}

async function main() {
  process.stdin.resume()
  let buf = Buffer.alloc(0)
  process.stdin.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk])
    while (true) {
      const headerEnd = buf.indexOf('\r\n\r\n')
      if (headerEnd < 0) break
      const header = buf.subarray(0, headerEnd).toString('utf8')
      const match = /Content-Length:\s*(\d+)/i.exec(header)
      if (!match) {
        buf = buf.subarray(headerEnd + 4)
        continue
      }
      const length = Number(match[1])
      const start = headerEnd + 4
      if (buf.length < start + length) break
      const body = buf.subarray(start, start + length).toString('utf8')
      buf = buf.subarray(start + length)
      let parsed
      try {
        parsed = JSON.parse(body)
      } catch {
        continue
      }
      handle(parsed).catch((error) => {
        if (parsed?.id != null) fail(parsed.id, error instanceof Error ? error.message : String(error))
      })
    }
  })
}

main()
