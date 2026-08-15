import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'
import { createLineReader, encodeMcpMessage, startStdioMcpServer } from './mcp-stdio.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('encodeMcpMessage is newline-delimited JSON, not Content-Length', () => {
  const wire = encodeMcpMessage({ jsonrpc: '2.0', id: 1, method: 'ping' })
  assert.equal(wire.endsWith('\n'), true)
  assert.equal(wire.includes('Content-Length'), false)
  assert.deepEqual(JSON.parse(wire.trim()), { jsonrpc: '2.0', id: 1, method: 'ping' })
})

test('line reader splits MCP SDK-style NDJSON', () => {
  const reader = createLineReader()
  assert.deepEqual(reader.push('{"a":1}\n{"b":2}\n'), ['{"a":1}', '{"b":2}'])
  assert.deepEqual(reader.push('{"c":'), [])
  assert.deepEqual(reader.push('3}\n'), ['{"c":3}'])
})

test('stdio server answers initialize and tools/list over NDJSON', async () => {
  const chunks = []
  const stdin = new EventEmitter()
  stdin.resume = () => {}
  const stdout = { write: (chunk) => chunks.push(chunk) }
  const server = startStdioMcpServer({
    name: 'fixture',
    tools: [{ name: 'echo', description: 'echo', inputSchema: { type: 'object' } }],
    call: async (name, args) => `${name}:${args.q}`,
    stdin,
    stdout,
  })
  await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } })
  await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })
  await server.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  await server.handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'echo', arguments: { q: 'hi' } } })
  const messages = chunks.map((row) => JSON.parse(String(row).trim()))
  assert.equal(messages[0].result.serverInfo.name, 'fixture')
  assert.equal(messages[1].result.tools[0].name, 'echo')
  assert.equal(messages[2].result.content[0].text, 'echo:hi')
})

async function rpcServer(script, requests, { timeoutMs = 8000 } = {}) {
  const child = spawn(process.execPath, [join(root, script)], { stdio: ['pipe', 'pipe', 'pipe'] })
  const reader = createLineReader()
  const replies = []
  const wanted = requests.filter((row) => row.id != null).length
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`timeout waiting for ${script}; stderr=${stderr.slice(-400)}`))
    }, timeoutMs)
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.stdout.on('data', (chunk) => {
      for (const line of reader.push(chunk)) {
        replies.push(JSON.parse(line))
        if (replies.length >= wanted) {
          clearTimeout(timer)
          child.kill('SIGKILL')
          resolve(replies)
        }
      }
    })
    child.on('error', reject)
    for (const request of requests) child.stdin.write(encodeMcpMessage(request))
  })
  return result
}

const handshake = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'codeseek-test', version: '1' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
]

test('shipped MCP servers no longer speak LSP Content-Length', () => {
  for (const file of ['scripts/web-search-mcp.mjs', 'scripts/buyer-dd-mcp.mjs', 'scripts/open-websearch-mcp.mjs']) {
    const body = readFileSync(join(root, file), 'utf8')
    assert.equal(body.includes('Content-Length:'), false, file)
    assert.match(body, /startStdioMcpServer/)
  }
})

test('web-search MCP speaks NDJSON that DSH can handshake', async () => {
  const replies = await rpcServer('scripts/web-search-mcp.mjs', handshake)
  assert.equal(replies[0].result.serverInfo.name, 'web-search')
  const names = replies[1].result.tools.map((row) => row.name).sort()
  assert.deepEqual(names, ['web_fetch', 'web_search'])
})

test('buyer-dd MCP speaks NDJSON that DSH can handshake', async () => {
  const replies = await rpcServer('scripts/buyer-dd-mcp.mjs', handshake)
  assert.equal(replies[0].result.serverInfo.name, 'buyer-dd')
  const names = replies[1].result.tools.map((row) => row.name).sort()
  assert.deepEqual(names, ['company_search', 'sanctions_search'])
})

test('open-websearch MCP speaks NDJSON that DSH can handshake', async () => {
  const replies = await rpcServer('scripts/open-websearch-mcp.mjs', handshake)
  assert.equal(replies[0].result.serverInfo.name, 'open-websearch')
  const names = replies[1].result.tools.map((row) => row.name).sort()
  assert.deepEqual(names, ['fetch_web', 'search'])
})
