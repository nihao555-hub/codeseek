#!/usr/bin/env node
/**
 * NDJSON MCP：包一层 Aas-ee/open-webSearch 的 CLI。
 * 裸 `npx open-websearch` 走官方 SDK stdio（Content-Length），DSH 只认换行 JSON-RPC。
 */
import { spawn } from 'node:child_process'
import { startStdioMcpServer } from './lib/mcp-stdio.mjs'
import { formatOpenWebSearch, parseOpenWebSearchJson } from './lib/open-websearch.mjs'
import { sanitizeSearchNoise } from './lib/web-search.mjs'

const PKG = process.env.OPEN_WEBSEARCH_BIN || 'open-websearch@latest'

function runCli(args, { timeoutMs = 45000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['-y', PKG, ...args], {
      env: {
        ...process.env,
        SEARCH_MODE: process.env.SEARCH_MODE || 'request',
        DEFAULT_SEARCH_ENGINE: process.env.DEFAULT_SEARCH_ENGINE || 'duckduckgo',
        ALLOWED_SEARCH_ENGINES: process.env.ALLOWED_SEARCH_ENGINES || 'duckduckgo,startpage,bing',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`open-websearch timed out: ${args[0]}`))
    }, timeoutMs)
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim().slice(-400) || `open-websearch exited ${code}`))
        return
      }
      resolve(stdout)
    })
  })
}

const TOOLS = [
  {
    name: 'search',
    description: 'Search the public web with Open-WebSearch (DuckDuckGo / Startpage / Bing, no API key).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results, 1-8' },
        engine: { type: 'string', description: 'duckduckgo, startpage, or bing' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_web',
    description: 'Fetch a public page via Open-WebSearch readability extractor.',
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
  name: 'open-websearch',
  version: '1.0.0',
  tools: TOOLS,
  async call(name, args) {
    if (name === 'search') {
      const query = String(args.query || '').trim()
      if (!query) return 'Missing query.'
      const limit = Math.min(8, Math.max(1, Number(args.limit) || 5))
      const engine = String(args.engine || process.env.DEFAULT_SEARCH_ENGINE || 'duckduckgo')
      try {
        const stdout = await runCli([
          'search', query,
          '--json',
          '--limit', String(limit),
          '--engine', engine,
          '--search-mode', 'request',
        ])
        const rows = parseOpenWebSearchJson(stdout)
        return formatOpenWebSearch(query, rows, `open-websearch ${engine}`)
      } catch (error) {
        const detail = sanitizeSearchNoise(error instanceof Error ? error.message : String(error))
        return `Search is temporarily unavailable for ${query}. ${detail}`.trim()
      }
    }
    if (name === 'fetch_web') {
      const url = String(args.url || '').trim()
      if (!url) return 'Missing url.'
      try {
        const stdout = await runCli(['fetch-web', url, '--json', '--max-chars', '8000'])
        const text = String(stdout)
        const data = JSON.parse(text.slice(Math.max(0, text.indexOf('{'))))
        if (data.status === 'error') throw new Error(data.error?.message || 'fetch failed')
        const body = data.data?.content || data.data?.text || data.content || JSON.stringify(data.data || data)
        return String(body).slice(0, 8000)
      } catch (error) {
        const detail = sanitizeSearchNoise(error instanceof Error ? error.message : String(error))
        return `Could not fetch ${url}: ${detail}`
      }
    }
    throw new Error(`Unknown tool: ${name}`)
  },
})
