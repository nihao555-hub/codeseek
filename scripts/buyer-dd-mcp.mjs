#!/usr/bin/env node
/**
 * 本地 stdio MCP：公开源买家背调（OpenCorporates + OpenSanctions）。
 * 协议是 MCP 换行 JSON-RPC（不是 LSP Content-Length）。
 */
import { searchCompanies, searchSanctions } from './lib/buyer-dd.mjs'
import { startStdioMcpServer } from './lib/mcp-stdio.mjs'

const TOOLS = [
  {
    name: 'company_search',
    description: 'Search OpenCorporates for a company name. Public company registry, not customs bills of lading.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Company name in English or local script' },
      },
      required: ['query'],
    },
  },
  {
    name: 'sanctions_search',
    description: 'Search OpenSanctions (OFAC / EU / UN and other lists). Hits need human identity confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Person or company name' },
      },
      required: ['query'],
    },
  },
]

startStdioMcpServer({
  name: 'buyer-dd',
  version: '1.0.0',
  tools: TOOLS,
  async call(name, args) {
    if (name === 'company_search') {
      const out = await searchCompanies(args.query)
      return out.text
    }
    if (name === 'sanctions_search') {
      const out = await searchSanctions(args.query)
      return out.text
    }
    throw new Error(`Unknown tool: ${name}`)
  },
})
