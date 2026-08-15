#!/usr/bin/env node
/**
 * 活体探测：本仓库默认打开的 MCP / 搜索库能不能被 DSH 那种 NDJSON 客户端调到。
 * 会打公开 HTTP，不当 unit test。
 *
 *   node scripts/probe-tools.mjs
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { searchWeb, fetchPage } from './lib/web-search.mjs'
import { searchCompanies, searchSanctions } from './lib/buyer-dd.mjs'
import { createLineReader, encodeMcpMessage } from './lib/mcp-stdio.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function clip(text, n = 240) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, n)
}

async function rpc(scriptOrCmd, args, requests, { timeoutMs = 20000, env } = {}) {
  const child = spawn(scriptOrCmd, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
  const reader = createLineReader()
  const replies = []
  const wanted = requests.filter((row) => row.id != null).length
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`timeout ${scriptOrCmd}; stderr=${clip(stderr, 400)}`))
    }, timeoutMs)
    child.stdout.on('data', (chunk) => {
      for (const line of reader.push(chunk)) {
        try {
          replies.push(JSON.parse(line))
        } catch {
          continue
        }
        if (replies.filter((row) => row.id != null).length >= wanted) {
          clearTimeout(timer)
          child.kill('SIGKILL')
          resolve(replies)
        }
      }
    })
    child.on('error', reject)
  })
  for (const request of requests) child.stdin.write(encodeMcpMessage(request))
  return result
}

function handshakePlus(call) {
  return [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'codeseek-probe', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: call },
  ]
}

function callText(replies, id = 3) {
  const row = replies.find((item) => item.id === id)
  if (row?.error) throw new Error(row.error.message || JSON.stringify(row.error))
  return row?.result?.content?.map((block) => block.text).join('\n') || ''
}

const rows = []
function record(name, ok, detail) {
  rows.push({ name, ok, detail: clip(detail, 320) })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: ${clip(detail, 220)}`)
}

async function main() {
  try {
    const search = await searchWeb('Sweden housewares importer stainless steel drinkware')
    const leaked = /\b429\b|too many requests/i.test(search.text || '')
    record(
      'lib.web_search',
      Boolean(search.results?.length) && !leaked,
      leaked ? `leaked HTTP status in tool text: ${clip(search.text, 180)}` : `${search.source} · ${search.results?.[0]?.title} ${search.results?.[0]?.url}`,
    )
  } catch (error) {
    record('lib.web_search', false, error.message)
  }

  try {
    const page = await fetchPage('https://example.com/')
    record('lib.web_fetch', /example/i.test(page), clip(page, 160))
  } catch (error) {
    record('lib.web_fetch', false, error.message)
  }

  try {
    const companies = await searchCompanies('IKEA of Sweden AB')
    const leaked = /\bHTTP\s*[1-5]\d{2}\b/.test(companies.text || '')
    record('lib.company_search', /IKEA|opencorporates|company|gleif/i.test(companies.text) && !leaked, leaked ? `leaked HTTP status: ${clip(companies.text, 180)}` : companies.text)
  } catch (error) {
    record('lib.company_search', false, error.message)
  }

  try {
    const sanctions = await searchSanctions('IKEA')
    const leaked = /\bHTTP\s*[1-5]\d{2}\b/.test(sanctions.text || '')
    record('lib.sanctions_search', /OpenSanctions|no list hit|POSSIBLE MATCH/i.test(sanctions.text) && !leaked, leaked ? `leaked HTTP status: ${clip(sanctions.text, 180)}` : sanctions.text)
  } catch (error) {
    record('lib.sanctions_search', false, error.message)
  }

  try {
    const replies = await rpc(process.execPath, [join(root, 'scripts/web-search-mcp.mjs')], handshakePlus({
      name: 'web_search',
      arguments: { query: 'Harbor Kiln tea infuser FOB Shenzhen' },
    }))
    const text = callText(replies)
    const leaked = /\b429\b|too many requests/i.test(text)
    record('mcp.web-search handshake+search', /Search:|http/i.test(text) && !leaked, leaked ? `leaked 429: ${clip(text, 180)}` : text)
  } catch (error) {
    record('mcp.web-search handshake+search', false, error.message)
  }

  try {
    const replies = await rpc(process.execPath, [join(root, 'scripts/web-search-mcp.mjs')], handshakePlus({
      name: 'web_fetch',
      arguments: { url: 'https://example.com/' },
    }))
    record('mcp.web-search web_fetch', /example/i.test(callText(replies)), callText(replies))
  } catch (error) {
    record('mcp.web-search web_fetch', false, error.message)
  }

  try {
    const replies = await rpc(process.execPath, [join(root, 'scripts/buyer-dd-mcp.mjs')], handshakePlus({
      name: 'company_search',
      arguments: { query: 'IKEA of Sweden AB' },
    }))
    const text = callText(replies)
    const leaked = /\bHTTP\s*[1-5]\d{2}\b/.test(text)
    record('mcp.buyer-dd company_search', /IKEA|opencorporates|company|gleif/i.test(text) && !leaked, leaked ? `leaked HTTP status: ${clip(text, 180)}` : text)
  } catch (error) {
    record('mcp.buyer-dd company_search', false, error.message)
  }

  try {
    const replies = await rpc(process.execPath, [join(root, 'scripts/buyer-dd-mcp.mjs')], handshakePlus({
      name: 'sanctions_search',
      arguments: { query: 'IKEA' },
    }))
    const text = callText(replies)
    const leaked = /\bHTTP\s*[1-5]\d{2}\b/.test(text)
    record('mcp.buyer-dd sanctions_search', /OpenSanctions|list hit|POSSIBLE MATCH/i.test(text) && !leaked, leaked ? `leaked HTTP status: ${clip(text, 180)}` : text)
  } catch (error) {
    record('mcp.buyer-dd sanctions_search', false, error.message)
  }

  try {
    const replies = await rpc('npx', ['-y', '@modelcontextprotocol/server-sequential-thinking'], handshakePlus({
      name: 'sequentialthinking',
      arguments: {
        thought: 'First confirm SKU from catalog.json, then search Nordic importers, then run buyer-dd.',
        nextThoughtNeeded: false,
        thoughtNumber: 1,
        totalThoughts: 1,
      },
    }), { timeoutMs: 90000 })
    const names = replies.find((row) => row.id === 2)?.result?.tools?.map((row) => row.name) || []
    record('mcp.sequential-thinking', names.includes('sequentialthinking') || /thought/i.test(callText(replies)), `tools=${names.join(',') || '?'} ${callText(replies)}`)
  } catch (error) {
    record('mcp.sequential-thinking', false, error.message)
  }

  try {
    const replies = await rpc(process.execPath, [join(root, 'scripts/open-websearch-mcp.mjs')], handshakePlus({
      name: 'search',
      arguments: { query: 'Harbor Kiln stainless tumbler', limit: 5, engine: 'duckduckgo' },
    }), { timeoutMs: 120000 })
    const names = replies.find((row) => row.id === 2)?.result?.tools?.map((row) => row.name) || []
    const text = callText(replies)
    const leaked = /\b429\b|too many requests/i.test(text)
    record(
      'mcp.open-websearch handshake+search',
      names.includes('search') && /http/i.test(text) && !leaked,
      leaked ? `leaked 429: ${clip(text, 180)}` : `tools=${names.join(',') || '?'} ${text}`,
    )
  } catch (error) {
    record('mcp.open-websearch handshake+search', false, error.message)
  }

  try {
    const replies = await rpc(process.execPath, [join(root, 'scripts/time-mcp.mjs')], handshakePlus({
      name: 'get_current_time',
      arguments: { timezone: 'Europe/Stockholm' },
    }))
    record('mcp.time get_current_time', /Europe\/Stockholm|UTC/i.test(callText(replies)), callText(replies))
  } catch (error) {
    record('mcp.time get_current_time', false, error.message)
  }

  try {
    const replies = await rpc(process.execPath, [join(root, 'scripts/documents-mcp.mjs')], handshakePlus({
      name: 'read_document',
      arguments: { path: join(root, 'team/playbooks/tools.md') },
    }))
    record('mcp.documents read_document', /MCP|web_search/i.test(callText(replies)), callText(replies))
  } catch (error) {
    record('mcp.documents read_document', false, error.message)
  }

  try {
    const replies = await rpc(process.execPath, [join(root, 'scripts/trade-crm-mcp.mjs')], handshakePlus({
      name: 'pipeline_summary',
      arguments: {},
    }))
    const names = replies.find((row) => row.id === 2)?.result?.tools?.map((row) => row.name) || []
    const text = callText(replies)
    record(
      'mcp.trade-crm pipeline_summary',
      names.includes('pipeline_summary') && names.includes('draft_outreach') && /leads|deals|pipeline/i.test(text),
      `tools=${names.join(',') || '?'} ${text}`,
    )
  } catch (error) {
    record('mcp.trade-crm pipeline_summary', false, error.message)
  }

  try {
    const replies = await rpc(process.execPath, [join(root, 'scripts/trade-open-data-mcp.mjs')], handshakePlus({
      name: 'kickoff',
      arguments: { market: 'Nordics', product: 'tumbler', text: '帮我找北欧买家' },
    }))
    const names = replies.find((row) => row.id === 2)?.result?.tools?.map((row) => row.name) || []
    const text = callText(replies)
    record(
      'mcp.trade-open-data kickoff',
      names.includes('kickoff') && names.includes('comtrade_preview') && names.includes('list_fairs') && /营销专家/.test(text) && /广告专员/.test(text),
      `tools=${names.join(',') || '?'} ${text}`,
    )
  } catch (error) {
    record('mcp.trade-open-data kickoff', false, error.message)
  }

  const failed = rows.filter((row) => !row.ok)
  console.log(`\n${rows.length - failed.length}/${rows.length} passed`)
  if (failed.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
