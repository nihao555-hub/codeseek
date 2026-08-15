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
      leaked ? `leaked 429 in tool text: ${clip(search.text, 180)}` : `${search.source} · ${search.results?.[0]?.title} ${search.results?.[0]?.url}`,
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
    record('lib.company_search', /IKEA|opencorporates|company/i.test(companies.text), companies.text)
  } catch (error) {
    record('lib.company_search', false, error.message)
  }

  try {
    const sanctions = await searchSanctions('IKEA')
    record('lib.sanctions_search', /OpenSanctions|no list hit|POSSIBLE MATCH/i.test(sanctions.text), sanctions.text)
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
    record('mcp.buyer-dd company_search', /IKEA|opencorporates|company/i.test(callText(replies)), callText(replies))
  } catch (error) {
    record('mcp.buyer-dd company_search', false, error.message)
  }

  try {
    const replies = await rpc(process.execPath, [join(root, 'scripts/buyer-dd-mcp.mjs')], handshakePlus({
      name: 'sanctions_search',
      arguments: { query: 'IKEA' },
    }))
    record('mcp.buyer-dd sanctions_search', /OpenSanctions|list hit|POSSIBLE MATCH/i.test(callText(replies)), callText(replies))
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

  const failed = rows.filter((row) => !row.ok)
  console.log(`\n${rows.length - failed.length}/${rows.length} passed`)
  if (failed.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
