#!/usr/bin/env node
/**
 * 本地 stdio MCP：SearXNG 开源元搜索，失败则 DuckDuckGo HTML。
 * 由 toolkit/catalog.json 的 web-search 条目启动，不要手动当 HTTP 服务。
 * 协议是 MCP 换行 JSON-RPC（不是 LSP Content-Length）。
 */
import { searchWeb, fetchPage } from './lib/web-search.mjs'
import { startStdioMcpServer } from './lib/mcp-stdio.mjs'

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

startStdioMcpServer({
  name: 'web-search',
  version: '1.0.0',
  tools: TOOLS,
  async call(name, args) {
    if (name === 'web_search') {
      const out = await searchWeb(args.query)
      return out.text
    }
    if (name === 'web_fetch') {
      return fetchPage(args.url)
    }
    throw new Error(`Unknown tool: ${name}`)
  },
})
