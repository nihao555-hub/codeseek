#!/usr/bin/env node
/**
 * 开源外贸数据 MCP：UN Comtrade preview + GitHub 展会日历。NDJSON。
 */
import {
  formatKickoff,
  kickoffPlan,
  previewComtrade,
  searchFairs,
} from './lib/trade-open-data.mjs'
import { startStdioMcpServer } from './lib/mcp-stdio.mjs'

const TOOLS = [
  {
    name: 'kickoff',
    description: 'One user sentence → who to dispatch. Does not spawn agents; the butler must subagent those 花名.',
    inputSchema: {
      type: 'object',
      properties: {
        market: { type: 'string' },
        product: { type: 'string' },
        text: { type: 'string', description: 'original user sentence' },
      },
    },
  },
  {
    name: 'comtrade_preview',
    description: 'UN Comtrade official preview: country × HS yearly totals. NOT bills of lading, not importer names.',
    inputSchema: {
      type: 'object',
      properties: {
        market: { type: 'string', description: 'buyer country, e.g. Sweden / SE / Nordics' },
        product: { type: 'string', description: 'SKU hint or HS code e.g. 9617' },
        period: { type: 'string', description: 'YYYY, default last calendar year' },
        flow: { type: 'string', description: 'M import (default) or X export' },
      },
      required: ['market'],
    },
  },
  {
    name: 'list_fairs',
    description: 'Open trade-show calendar (LensmorOfficial/trade-show-calendar on GitHub). Confirm dates on the official site.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        country: { type: 'string' },
        industry: { type: 'string' },
        region: { type: 'string' },
      },
    },
  },
]

startStdioMcpServer({
  name: 'trade-open-data',
  version: '1.0.0',
  tools: TOOLS,
  async call(name, args) {
    if (name === 'kickoff') return formatKickoff(kickoffPlan(args || {}))
    if (name === 'comtrade_preview') {
      const out = await previewComtrade(args || {})
      return out.text
    }
    if (name === 'list_fairs') {
      const out = await searchFairs(args || {})
      return out.text
    }
    throw new Error(`Unknown tool: ${name}`)
  },
})
