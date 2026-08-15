#!/usr/bin/env node
/**
 * 时区与当前时间 MCP。NDJSON，不依赖 uvx。
 */
import { startStdioMcpServer } from './lib/mcp-stdio.mjs'

function formatInZone(date, timeZone) {
  const zone = timeZone || 'UTC'
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'shortOffset',
    }).formatToParts(date)
    const pick = (type) => parts.find((part) => part.type === type)?.value || ''
    return {
      timeZone: zone,
      isoUtc: date.toISOString(),
      local: `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')} ${pick('timeZoneName')}`.trim(),
      unixMs: date.getTime(),
    }
  } catch {
    throw new Error(`unknown time zone: ${zone}`)
  }
}

function parseWhen(value) {
  if (!value) return new Date()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`invalid time: ${value}`)
  return date
}

const TOOLS = [
  {
    name: 'get_current_time',
    description: 'Current time in UTC and an optional IANA time zone (e.g. Asia/Shanghai, Europe/Stockholm).',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'IANA time zone' },
      },
    },
  },
  {
    name: 'convert_time',
    description: 'Convert an ISO-8601 timestamp between time zones.',
    inputSchema: {
      type: 'object',
      properties: {
        time: { type: 'string', description: 'ISO-8601 timestamp' },
        fromTimezone: { type: 'string' },
        toTimezone: { type: 'string' },
      },
      required: ['toTimezone'],
    },
  },
]

startStdioMcpServer({
  name: 'time',
  version: '1.0.0',
  tools: TOOLS,
  async call(name, args) {
    if (name === 'get_current_time') {
      const now = new Date()
      return JSON.stringify({
        utc: formatInZone(now, 'UTC'),
        zone: formatInZone(now, args.timezone || 'Asia/Shanghai'),
      }, null, 2)
    }
    if (name === 'convert_time') {
      const date = parseWhen(args.time)
      return JSON.stringify({
        source: formatInZone(date, args.fromTimezone || 'UTC'),
        target: formatInZone(date, args.toTimezone),
      }, null, 2)
    }
    throw new Error(`Unknown tool: ${name}`)
  },
})
