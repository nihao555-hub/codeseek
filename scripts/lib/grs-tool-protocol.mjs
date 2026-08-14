/**
 * GRS 网关目前不返回 OpenAI native tool_calls。
 * 本模块把 tools 编进提示词，并从模型文本里解析 <tool_call>，再还原成 OpenAI 格式。
 */

const TOOL_CALL_RE = /<tool_call\b[^>]*>([\s\S]*?)<\/tool_call>/gi
const FENCE_RE = /```(?:tool_call|toolcall|json)\s*\n([\s\S]*?)```/gi

function asText(content) {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object') {
        if (typeof part.text === 'string') return part.text
        if (typeof part.content === 'string') return part.content
      }
      return ''
    }).join('')
  }
  return String(content)
}

function parseJsonish(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function normalizeCall(value, fallbackName) {
  if (value == null) return null
  if (typeof value === 'string') {
    const parsed = parseJsonish(value)
    return parsed ? normalizeCall(parsed, fallbackName) : null
  }
  if (typeof value !== 'object') return null
  const name = String(value.name ?? value.tool ?? fallbackName ?? '').trim()
  if (!name) return null
  let args = value.arguments ?? value.parameters ?? value.args ?? value.input
  if (typeof args === 'string') {
    args = parseJsonish(args) ?? {}
  }
  if (args == null || typeof args !== 'object' || Array.isArray(args)) args = {}
  const id = typeof value.id === 'string' && value.id.startsWith('call_')
    ? value.id
    : undefined
  return { id, name, arguments: args }
}

function parseCallBody(body, openTag) {
  const nameFromTag = /name\s*=\s*["']([^"']+)["']/i.exec(openTag || '')?.[1]
  const trimmed = String(body ?? '').trim()
  const asJson = parseJsonish(trimmed)
  if (asJson) {
    if (asJson.name || asJson.tool) return normalizeCall(asJson, nameFromTag)
    if (nameFromTag) return normalizeCall({ name: nameFromTag, arguments: asJson })
  }
  const lines = trimmed.split('\n')
  const first = lines[0]?.trim()
  if (first && /^[A-Za-z0-9_.-]+$/.test(first) && lines.length > 1) {
    return normalizeCall({ name: first, arguments: parseJsonish(lines.slice(1).join('\n')) || {} })
  }
  if (nameFromTag) return normalizeCall({ name: nameFromTag, arguments: asJson || {} })
  return null
}

/**
 * 从助手文本解析工具调用。
 * @param {string} text
 * @returns {{ text: string, calls: Array<{ id?: string, name: string, arguments: Record<string, unknown> }> }}
 */
export function parseAssistantToolPayload(text) {
  const source = String(text ?? '')
  const calls = []
  const used = []

  for (const match of source.matchAll(TOOL_CALL_RE)) {
    const call = parseCallBody(match[1], match[0])
    if (call) {
      calls.push(call)
      used.push(match[0])
    }
  }

  if (calls.length === 0) {
    for (const match of source.matchAll(FENCE_RE)) {
      const call = parseCallBody(match[1], '')
      if (call) {
        calls.push(call)
        used.push(match[0])
      }
    }
  }

  let cleaned = source
  for (const block of used) cleaned = cleaned.replace(block, '')
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()
  return { text: cleaned, calls }
}

function toolSchema(tool) {
  if (!tool || typeof tool !== 'object') return null
  if (tool.type === 'function' && tool.function) {
    return {
      name: tool.function.name,
      description: tool.function.description || '',
      parameters: tool.function.parameters || { type: 'object', properties: {} },
    }
  }
  if (typeof tool.name === 'string') {
    return {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters || { type: 'object', properties: {} },
    }
  }
  return null
}

export function buildToolProtocolPrompt(tools) {
  const schemas = (tools || []).map(toolSchema).filter(Boolean)
  const catalog = schemas.map((schema) => {
    return `- ${schema.name}: ${schema.description}\n  parameters: ${JSON.stringify(schema.parameters)}`
  }).join('\n')
  return [
    'You can use tools. When a tool is required, emit one or more <tool_call> blocks, then STOP.',
    'Do not claim you already read a file or ran a command unless a <tool_result> is in this conversation.',
    'Exact format:',
    '<tool_call>',
    '{"name": "TOOL_NAME", "arguments": { }}',
    '</tool_call>',
    'Rules:',
    '- arguments must be a JSON object matching that tool\'s schema',
    '- multiple tools: multiple <tool_call> blocks',
    '- do not wrap the block in markdown fences',
    '- after <tool_result> arrives, continue the task',
    '- if no tool is needed, answer normally with no <tool_call>',
    'Available tools:',
    catalog || '(none)',
  ].join('\n')
}

function stringifyCall(call) {
  return `<tool_call>\n${JSON.stringify({ name: call.name, arguments: call.arguments })}\n</tool_call>`
}

function assistantFromNative(message) {
  const parts = []
  const content = asText(message.content).trim()
  if (content) parts.push(content)
  for (const tc of message.tool_calls || []) {
    let args = {}
    try {
      args = JSON.parse(tc.function?.arguments || '{}')
    } catch {
      args = {}
    }
    parts.push(stringifyCall({
      name: tc.function?.name || tc.name || 'unknown',
      arguments: args,
    }))
  }
  return { role: 'assistant', content: parts.join('\n\n') }
}

function toolResultMessage(message) {
  const name = message.name || ''
  const id = message.tool_call_id || message.toolCallId || ''
  const body = asText(message.content)
  return {
    role: 'user',
    content: `<tool_result name="${name}" id="${id}">\n${body}\n</tool_result>`,
  }
}

/**
 * 把 OpenAI tools 请求改写成 GRS 能消化的纯文本对话。
 * @param {Record<string, unknown>} body
 */
export function toUpstreamChatBody(body) {
  const tools = Array.isArray(body.tools) ? body.tools : []
  const toolChoice = body.tool_choice
  const skipTools = toolChoice === 'none' || (toolChoice && typeof toolChoice === 'object' && toolChoice.type === 'none')
  const useProtocol = tools.length > 0 && !skipTools

  const rewritten = []
  for (const raw of Array.isArray(body.messages) ? body.messages : []) {
    if (!raw || typeof raw !== 'object') continue
    if (raw.role === 'assistant' && Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0) {
      rewritten.push(assistantFromNative(raw))
      continue
    }
    if (raw.role === 'tool' || raw.role === 'function') {
      rewritten.push(toolResultMessage(raw))
      continue
    }
    rewritten.push({
      role: raw.role,
      content: raw.content,
    })
  }

  if (useProtocol) {
    const protocol = buildToolProtocolPrompt(tools)
    const extra = toolChoice === 'required' || (toolChoice && toolChoice.type === 'required')
      ? '\nYou MUST call at least one tool now.'
      : ''
    const sys = rewritten.find((m) => m.role === 'system')
    if (sys) sys.content = `${protocol}${extra}\n\n${asText(sys.content)}`
    else rewritten.unshift({ role: 'system', content: protocol + extra })
  }

  const merged = []
  for (const message of rewritten) {
    const last = merged[merged.length - 1]
    if (last && last.role === message.role && typeof last.content === 'string' && typeof message.content === 'string') {
      last.content = `${last.content}\n\n${message.content}`
    } else {
      merged.push({ ...message })
    }
  }

  const out = { ...body, messages: merged }
  delete out.tools
  delete out.tool_choice
  delete out.parallel_tool_calls
  delete out.functions
  delete out.function_call
  return out
}

function randomCallId() {
  return `call_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`
}

export function toOpenAiToolCalls(calls) {
  return calls.map((call, index) => ({
    id: call.id || randomCallId(),
    type: 'function',
    index,
    function: {
      name: call.name,
      arguments: JSON.stringify(call.arguments ?? {}),
    },
  }))
}

function chunkTemplate(base, delta, finish = null) {
  return {
    id: base.id,
    object: 'chat.completion.chunk',
    created: base.created,
    model: base.model,
    choices: [{
      index: 0,
      delta,
      finish_reason: finish,
    }],
  }
}

/**
 * 把上游完成结果改写成带 native tool_calls 的 OpenAI 响应。
 * @param {{ stream: boolean, upstream: Record<string, unknown>, content: string, calls: ReturnType<typeof parseAssistantToolPayload>['calls'] }} input
 */
export function buildClientResponse({ stream, upstream, content, calls }) {
  const created = Number(upstream.created) || Math.floor(Date.now() / 1000)
  const base = {
    id: typeof upstream.id === 'string' ? upstream.id : `chatcmpl-proxy-${created}`,
    created,
    model: upstream.model || 'unknown',
    usage: upstream.usage,
  }
  const toolCalls = toOpenAiToolCalls(calls)
  const preamble = content || null

  if (!stream) {
    return {
      id: base.id,
      object: 'chat.completion',
      created: base.created,
      model: base.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: preamble,
          tool_calls: toolCalls,
        },
        finish_reason: 'tool_calls',
      }],
      usage: base.usage,
    }
  }

  const chunks = []
  chunks.push(chunkTemplate(base, { role: 'assistant', content: preamble ? '' : null }))
  if (preamble) {
    chunks.push(chunkTemplate(base, { content: preamble }))
  }
  for (const [index, call] of toolCalls.entries()) {
    chunks.push(chunkTemplate(base, {
      tool_calls: [{
        index,
        id: call.id,
        type: 'function',
        function: { name: call.function.name, arguments: '' },
      }],
    }))
    chunks.push(chunkTemplate(base, {
      tool_calls: [{
        index,
        type: 'function',
        function: { arguments: call.function.arguments },
      }],
    }))
  }
  const done = chunkTemplate(base, {}, 'tool_calls')
  if (base.usage) done.usage = base.usage
  chunks.push(done)
  return chunks
}

export function sseEncode(chunks) {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'
}

/**
 * 收集 OpenAI SSE / JSON 完成内容。
 * @param {string} raw
 * @param {boolean} stream
 */
export function collectCompletion(raw, stream) {
  if (!stream) {
    const data = JSON.parse(raw)
    const choice = (data.choices || [])[0] || {}
    const message = choice.message || {}
    return {
      data,
      content: asText(message.content),
      nativeToolCalls: Array.isArray(message.tool_calls) && message.tool_calls.length > 0,
      finishReason: choice.finish_reason,
    }
  }

  let content = ''
  let nativeToolCalls = false
  let finishReason
  const acc = { id: undefined, created: undefined, model: undefined, usage: undefined, choices: [{ delta: {} }] }
  for (const block of String(raw).split(/\n\n+/)) {
    const line = block.split('\n').find((l) => l.startsWith('data:'))
    if (!line) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    let data
    try {
      data = JSON.parse(payload)
    } catch {
      continue
    }
    if (typeof data.id === 'string') acc.id = data.id
    if (data.created != null) acc.created = data.created
    if (typeof data.model === 'string') acc.model = data.model
    if (data.usage) acc.usage = data.usage
    const choice = (data.choices || [])[0] || {}
    const delta = choice.delta || {}
    if (typeof delta.content === 'string') content += delta.content
    if (typeof choice.message?.content === 'string') content += choice.message.content
    if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) nativeToolCalls = true
    if (choice.finish_reason) finishReason = choice.finish_reason
  }
  return { data: acc, content, nativeToolCalls, finishReason }
}
