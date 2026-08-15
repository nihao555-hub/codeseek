/**
 * MCP stdio framing used by DeepSeek Harness (`@modelcontextprotocol/sdk`).
 *
 * Messages are newline-delimited JSON-RPC. LSP `Content-Length` framing is
 * not spoken by the SDK client and will hang `dsh-mcp-client` forever.
 */

export function encodeMcpMessage(message) {
  return `${JSON.stringify(message)}\n`
}

export function createLineReader() {
  let buf = ''
  return {
    push(chunk) {
      buf += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk)
      const lines = []
      while (true) {
        const idx = buf.indexOf('\n')
        if (idx < 0) break
        const line = buf.slice(0, idx).replace(/\r$/, '')
        buf = buf.slice(idx + 1)
        if (line.trim()) lines.push(line)
      }
      return lines
    },
  }
}

export function startStdioMcpServer({
  name,
  version = '1.0.0',
  tools,
  call,
  stdin = process.stdin,
  stdout = process.stdout,
} = {}) {
  if (!name) throw new Error('startStdioMcpServer: name is required')
  if (!Array.isArray(tools)) throw new Error('startStdioMcpServer: tools is required')
  if (typeof call !== 'function') throw new Error('startStdioMcpServer: call is required')

  const send = (message) => {
    stdout.write(encodeMcpMessage(message))
  }
  const reply = (id, result) => {
    if (id == null) return
    send({ jsonrpc: '2.0', id, result })
  }
  const fail = (id, message) => {
    if (id == null) return
    send({ jsonrpc: '2.0', id, error: { code: -32000, message: String(message) } })
  }

  async function handle(message) {
    if (!message || typeof message !== 'object') return
    const { id, method, params } = message
    if (method === 'initialize') {
      reply(id, {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name, version },
      })
      return
    }
    if (method === 'notifications/initialized' || method === 'notifications/cancelled') return
    if (method === 'ping') {
      reply(id, {})
      return
    }
    if (method === 'tools/list') {
      reply(id, { tools })
      return
    }
    if (method === 'tools/call') {
      const toolName = params?.name
      const args = params?.arguments || {}
      try {
        const text = await call(toolName, args)
        reply(id, { content: [{ type: 'text', text: String(text ?? '') }] })
      } catch (error) {
        fail(id, error instanceof Error ? error.message : String(error))
      }
      return
    }
    if (id != null) fail(id, `Unknown method: ${method}`)
  }

  const reader = createLineReader()
  stdin.resume?.()
  stdin.on('data', (chunk) => {
    for (const line of reader.push(chunk)) {
      let parsed
      try {
        parsed = JSON.parse(line)
      } catch {
        continue
      }
      handle(parsed).catch((error) => {
        fail(parsed?.id, error instanceof Error ? error.message : String(error))
      })
    }
  })

  return { send, reply, fail, handle }
}
