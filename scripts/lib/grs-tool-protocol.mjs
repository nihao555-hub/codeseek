/**
 * GRS 网关目前不返回 OpenAI native tool_calls。
 * 本模块把 tools 编进提示词，并从模型文本里解析 <tool_call>，再还原成 OpenAI 格式。
 */

const TOOL_CALL_RE = /<tool_call\b[^>]*>([\s\S]*?)<\/tool_call>/gi
const FUNCTION_CALL_RE = /<function_call\b[^>]*>([\s\S]*?)<\/function_call>/gi
const HERMES_FN_RE = /<function=([A-Za-z0-9_.-]+)>([\s\S]*?)<\/function>/gi
const INVOKE_RE = /<invoke\b[^>]*name\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/invoke>/gi
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

function collectTextish(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(collectTextish).join('')
  if (typeof value === 'object') {
    return collectTextish(value.text ?? value.content ?? value.reasoning_content ?? value.reasoning)
  }
  return ''
}

function pickHiddenReasoning(obj) {
  if (!obj || typeof obj !== 'object') return ''
  return [obj.reasoning_content, obj.reasoning, obj.thinking, obj.thought]
    .map(collectTextish)
    .join('')
}

/** GPT-5 / o-series 走推理 token，max_tokens 常被忽略或直接导致空正文。 */
const REASONING_MODEL_RE = /^(gpt-5|o1|o3|o4)|gpt-5\./i

export function isReasoningModel(model) {
  return REASONING_MODEL_RE.test(String(model || ''))
}

/**
 * 把 GPT-5 类模型的 max_tokens 改成 max_completion_tokens，避免空 completion。
 * @param {Record<string, unknown>} body
 */
export function applyReasoningModelCompat(body) {
  if (!body || typeof body !== 'object') return body
  if (!isReasoningModel(body.model)) return body
  const next = { ...body }
  if (next.max_tokens != null && next.max_completion_tokens == null) {
    next.max_completion_tokens = next.max_tokens
    delete next.max_tokens
  }
  return next
}

/**
 * 空回复重试时抬高推理模型的完成额度，避免思考把 max tokens 吃光。
 * @param {Record<string, unknown>} body
 * @param {number} [floor]
 */
export function bumpReasoningBudget(body, floor = 8192) {
  const next = { ...body }
  const current = Number(next.max_completion_tokens ?? next.max_tokens ?? 0)
  if (!Number.isFinite(current) || current < floor) {
    next.max_completion_tokens = floor
    delete next.max_tokens
  }
  return next
}

export const EMPTY_COMPLETION_NUDGE = [
  '[runtime] Your previous completion finished with empty visible content.',
  'Hidden reasoning is not shown to the user or the agent loop.',
  'Reply now with visible assistant text and/or a <tool_call> JSON block.',
  'Do not wait for the human to say 继续.',
].join(' ')

export const EMPTY_COMPLETION_FALLBACK = [
  '上一轮模型完成了但没有可见正文（常见于 gpt-5.6-sol 把字写进思考栏）。',
  '请再发一次同样的任务，或改用 gemini-3.5-flash。',
].join('')

export const TOOL_SKIP_NUDGE = [
  '[runtime] Your last completion had no executable <tool_call> block.',
  'This gateway cannot run tools from prose, hidden reasoning, or "I will now…" sentences.',
  'Immediately emit one or more <tool_call> JSON blocks using the available tools.',
  'Typical first calls: skill, read, web_search, list_agents, bash.',
  'Do not apologize. Do not recap the plan without a tool call.',
].join(' ')

const CHAT_ONLY_RE = /^(你好|您好|嗨|哈喽|在吗|谢谢|thanks|thank you|ok|okay|嗯|好的|hi|hello|hey)[\s!！。.?？~]*$/i
const AGENT_TASK_RE = /@|找客|挖客|背调|尽调|搜|搜索|报价|询盘|开发信|独立站|改代码|实现|修复|读取|打开|写入|派|web_search|SKU|MOQ|买家|进口商|海关|展会|定时|每天|每周|开干|OFAC|工商|制裁|read |write |search |fix |build |implement |dispatch |subagent|catalog/i
const SKIPPED_TOOL_TALK_RE = /I('ll| will) (now )?(search|read|call|use|check|look)|let me (search|read|check|look|use)|我(先|来|将|这就)?(搜索|检索|读取|调用|用工具|查一下|打开)|使用\s*(web_search|bash|read|skill)|calling (the )?\w+ tool|接下来(我)?(会|将)(调用|使用)/i

/**
 * @param {unknown[]} messages
 */
export function lastUserText(messages) {
  const list = Array.isArray(messages) ? messages : []
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i]
    if (!message || message.role !== 'user') continue
    const text = asText(message.content)
    if (text.includes('<tool_result')) continue
    return text
  }
  return ''
}

/**
 * 用户这句像要干活（搜、读、派工），而不是寒暄。
 * @param {unknown[]} messages
 */
export function userTurnExpectsTools(messages) {
  if (lastTurnIsToolResult(messages)) return false
  const text = lastUserText(messages).trim()
  if (!text || CHAT_ONLY_RE.test(text)) return false
  return AGENT_TASK_RE.test(text) || text.length > 48
}

/**
 * 模型在说话「我去搜/读」，但没吐出可执行的 tool_call。
 * @param {string} content
 */
export function looksLikeSkippedToolCall(content) {
  const text = String(content || '')
  if (!text.trim()) return true
  return SKIPPED_TOOL_TALK_RE.test(text)
}

/**
 * @param {{ rewrite: boolean, messages?: unknown[], calls?: unknown[], content?: string }} input
 */
export function shouldRetryMissingToolCalls({ rewrite, messages, calls, content } = {}) {
  if (!rewrite) return false
  if (Array.isArray(calls) && calls.length > 0) return false
  if (!userTurnExpectsTools(messages)) return false
  return true
}

/**
 * @param {Record<string, unknown>} body
 */
export function nudgeToolSkipRetry(body) {
  const next = { ...body, messages: [...(Array.isArray(body.messages) ? body.messages : [])] }
  next.messages.push({ role: 'user', content: TOOL_SKIP_NUDGE })
  return next
}

/**
 * @param {Record<string, unknown>} body
 */
export function nudgeEmptyRetry(body) {
  const next = { ...body, messages: [...(Array.isArray(body.messages) ? body.messages : [])] }
  next.messages.push({ role: 'user', content: EMPTY_COMPLETION_NUDGE })
  return next
}

function repairJsonControlChars(text) {
  let out = ''
  let inString = false
  let escaped = false
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        out += ch
        escaped = false
        continue
      }
      if (ch === '\\') {
        out += ch
        escaped = true
        continue
      }
      if (ch === '"') {
        out += ch
        inString = false
        continue
      }
      if (ch === '\n') {
        out += '\\n'
        continue
      }
      if (ch === '\r') {
        out += '\\r'
        continue
      }
      if (ch === '\t') {
        out += '\\t'
        continue
      }
      out += ch
      continue
    }
    if (ch === '"') inString = true
    out += ch
  }
  return out
}

function parseJsonish(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const candidates = [text]
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1))
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      try {
        return JSON.parse(repairJsonControlChars(candidate))
      } catch {
        continue
      }
    }
  }
  return null
}

function firstString(obj, keys) {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

function shortCommandDescription(command) {
  const one = String(command || '').replace(/\s+/g, ' ').trim()
  if (!one) return 'Run command'
  return one.length > 72 ? `${one.slice(0, 69)}...` : one
}

function assignCanonical(out, canonical, aliases) {
  const current = out[canonical]
  if (!(typeof current === 'string' && current.trim())) {
    const picked = firstString(out, aliases)
    if (picked) out[canonical] = picked
  }
  for (const alias of aliases) delete out[alias]
}

/**
 * Gemini 常把 file_path 写成 path、漏掉 bash 必填的 description。
 * 在交给 Harness 之前把常见别名收成 schema 字段。
 */
export const TEAM_ROSTER_LABELS = [
  '管家', '营销专家', '运营专家', '建站专家', '社媒专家',
  '询盘专员', '报价专员', '合规专员', '背调专员', '广告专员',
]

const TEAM_ROSTER_ALIASES = {
  营销: '营销专家',
  marketing: '营销专家',
  运营: '运营专家',
  ops: '运营专家',
  建站: '建站专家',
  site: '建站专家',
  社媒: '社媒专家',
  social: '社媒专家',
  询盘: '询盘专员',
  inquiry: '询盘专员',
  报价: '报价专员',
  quote: '报价专员',
  合规: '合规专员',
  compliance: '合规专员',
  背调: '背调专员',
  dd: '背调专员',
  尽调: '背调专员',
  广告: '广告专员',
  ads: '广告专员',
  lead: '管家',
  管家: '管家',
}

/** 把 @营销 / 营销专家 / marketing 收成侧栏花名。认不出则返回空。 */
export function canonicalRosterLabel(value) {
  const raw = String(value || '').trim().replace(/^@/, '')
  if (!raw) return ''
  if (TEAM_ROSTER_LABELS.includes(raw)) return raw
  return TEAM_ROSTER_ALIASES[raw] || TEAM_ROSTER_ALIASES[raw.toLowerCase()] || ''
}

function pickRosterLabel(obj) {
  for (const key of ['label', 'name', 'role', 'title', 'description']) {
    const hit = canonicalRosterLabel(obj[key])
    if (hit) return hit
  }
  return ''
}

export function normalizeToolArguments(name, args) {
  const out = { ...(args && typeof args === 'object' && !Array.isArray(args) ? args : {}) }
  const tool = String(name || '')

  if (tool === 'read' || tool === 'write' || tool === 'edit') {
    assignCanonical(out, 'file_path', ['path', 'filepath', 'file', 'filename'])
  }

  if (tool === 'bash') {
    assignCanonical(out, 'command', ['cmd', 'script', 'shell'])
    if (!(typeof out.description === 'string' && out.description.trim()) && typeof out.command === 'string') {
      out.description = shortCommandDescription(out.command)
    }
  }

  if (tool === 'glob') {
    assignCanonical(out, 'pattern', ['glob', 'glob_pattern', 'globPattern', 'query'])
    assignCanonical(out, 'path', ['directory', 'dir', 'root', 'cwd', 'file_path'])
  }

  if (tool === 'grep') {
    assignCanonical(out, 'pattern', ['query', 'regex', 'search'])
    assignCanonical(out, 'path', ['directory', 'dir', 'file_path', 'file'])
  }

  if (tool === 'skill') {
    assignCanonical(out, 'name', ['skill', 'skill_name', 'id'])
  }

  if (tool === 'web_search' || tool === 'mcp__web-search__web_search') {
    assignCanonical(out, 'query', ['q', 'search', 'text', 'keyword'])
  }

  if (tool === 'web_fetch' || tool === 'mcp__web-search__web_fetch') {
    assignCanonical(out, 'url', ['uri', 'link', 'href'])
  }

  if (tool === 'subagent' || tool === 'subagent_fork') {
    const label = pickRosterLabel(out)
    const rawDescription = typeof out.description === 'string' ? out.description.trim() : ''
    assignCanonical(out, 'prompt', ['message', 'instruction', 'task', 'content', 'input'])
    if (label) {
      if (rawDescription && !canonicalRosterLabel(rawDescription) && typeof out.prompt === 'string') {
        out.prompt = `任务摘要：${rawDescription}\n\n${out.prompt}`
      }
      out.description = label
    } else {
      assignCanonical(out, 'description', ['label', 'title', 'name', 'role'])
    }
    delete out.label
    delete out.name
    delete out.role
    delete out.title
    if (out.background === true || out.async === true) out.run_in_background = true
    delete out.background
    delete out.async
  }

  if (tool === 'send_message') {
    assignCanonical(out, 'subagent_id', ['id', 'agent_id', 'target', 'to'])
    assignCanonical(out, 'message', ['content', 'text', 'prompt', 'body'])
  }

  if (tool === 'interrupt_agent') {
    assignCanonical(out, 'agent_id', ['id', 'subagent_id', 'target'])
  }

  if (tool === 'report') {
    assignCanonical(out, 'output', ['content', 'text', 'message', 'report', 'body'])
  }

  if (tool === 'list_agents') {
    assignCanonical(out, 'scope', ['level', 'range'])
  }

  return out
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
  return { id, name, arguments: normalizeToolArguments(name, args) }
}

function parseXmlParameters(body) {
  const args = {}
  const re = /<parameter\b[^>]*name\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/parameter>/gi
  for (const match of String(body || '').matchAll(re)) {
    args[match[1]] = match[2].trim()
  }
  return Object.keys(args).length ? args : null
}

function recoverToolCallObject(text) {
  const source = String(text || '')
  const name = /"(?:name|tool)"\s*:\s*"([A-Za-z0-9_.-]+)"/.exec(source)?.[1]
  if (!name) return null
  const args = {}
  const keys = ['output', 'content', 'new_string', 'old_string', 'command', 'cmd', 'query', 'pattern', 'file_path', 'path', 'description', 'prompt', 'message', 'subagent_id']
  for (const key of keys) {
    const token = `"${key}"`
    const at = source.indexOf(token)
    if (at < 0) continue
    const colon = source.indexOf(':', at + token.length)
    if (colon < 0) continue
    let i = colon + 1
    while (i < source.length && /\s/.test(source[i])) i += 1
    if (source[i] !== '"') continue
    i += 1
    const tail = source.slice(i)
    const close = tail.match(/"\s*(?:,\s*"[A-Za-z0-9_]+"\s*:|\}[\s}]*)$/)
    const raw = close ? tail.slice(0, close.index) : tail.replace(/"\s*\}[\s}]*$/, '')
    args[key] = raw.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"')
  }
  return { name, arguments: args }
}

function parseCallBody(body, openTag) {
  const nameFromTag = /name\s*=\s*["']([^"']+)["']/i.exec(openTag || '')?.[1]
  const trimmed = String(body ?? '').trim()
  const asJson = parseJsonish(trimmed)
  if (asJson) {
    if (asJson.name || asJson.tool) return normalizeCall(asJson, nameFromTag)
    if (nameFromTag) return normalizeCall({ name: nameFromTag, arguments: asJson })
  }
  const recovered = recoverToolCallObject(trimmed)
  if (recovered) return normalizeCall(recovered, nameFromTag)
  const xmlArgs = parseXmlParameters(trimmed)
  if (xmlArgs && nameFromTag) return normalizeCall({ name: nameFromTag, arguments: xmlArgs })
  const lines = trimmed.split('\n')
  const first = lines[0]?.trim()
  if (first && /^[A-Za-z0-9_.-]+$/.test(first) && lines.length > 1) {
    return normalizeCall({ name: first, arguments: parseJsonish(lines.slice(1).join('\n')) || xmlArgs || {} })
  }
  if (nameFromTag) return normalizeCall({ name: nameFromTag, arguments: asJson || xmlArgs || {} })
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
    for (const match of source.matchAll(FUNCTION_CALL_RE)) {
      const call = parseCallBody(match[1], match[0])
      if (call) {
        calls.push(call)
        used.push(match[0])
      }
    }
  }

  if (calls.length === 0) {
    for (const match of source.matchAll(HERMES_FN_RE)) {
      const call = parseCallBody(match[2], `name="${match[1]}"`)
      if (call) {
        calls.push(call)
        used.push(match[0])
      }
    }
  }

  if (calls.length === 0) {
    const dangling = source.match(/<(?:tool_call|function_call)\b[^>]*>([\s\S]*)$/i)
    if (dangling) {
      const call = parseCallBody(dangling[1], dangling[0])
      if (call) {
        calls.push(call)
        used.push(dangling[0])
      }
    }
  }

  if (calls.length === 0) {
    for (const match of source.matchAll(INVOKE_RE)) {
      const call = parseCallBody(match[2], `name="${match[1]}"`)
      if (call) {
        calls.push(call)
        used.push(match[0])
      }
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

  if (calls.length === 0) {
    const lone = normalizeCall(parseJsonish(source))
    if (lone) {
      calls.push(lone)
      used.push(source)
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

export const TOOL_CONTINUE_HINT = [
  '[runtime] Tool results above already ran in this same user turn.',
  'Keep calling tools with more <tool_call> blocks until the original user task is fully done.',
  'Do not ask the human to reply 继续 / continue / keep going just to take the next step.',
  'edit on an existing file requires a successful `read` tool call on that path first (bash/cat/grep do not count).',
  'If cwd is empty or not the repo, use absolute paths under /workspace. The storefront lives at /workspace/store/.',
  'If skill is unknown, skip it and keep the 获客/成交 loop under /workspace/team/. Independent site lives at /workspace/store/.',
  'Prefer official web_search for live lookup (DuckDuckGo, then Wikipedia).',
  'Put titles and URLs in the reply text; the Search card is collapsed until the user clicks it.',
  'Extra engines: mcp__open-websearch__search. Official web_fetch is disabled; fetch URLs with mcp__web-search__web_fetch.',
  'Buyer due diligence: mcp__buyer-dd__company_search and mcp__buyer-dd__sanctions_search; never invent customs B/L.',
  'CRM: mcp__trade-crm__search_queries, upsert_lead, capture_public_email, send_outreach, quote_catalog, record_reply, upsert_deal. Capture emails from official Impressum pages; never invent To: addresses. quote_catalog reads store/data/catalog.json (hints like tumbler map to HK-TB-500-SS). record_reply is for the NAMED buyer qty, not other leads.',
  'Open data: mcp__trade-open-data__kickoff, comtrade_preview (country×HS totals, NOT bills of lading), list_fairs.',
  'If the user says daily/weekly, schedule_create (every_seconds >= 300) on a session created after the schedule overlay loaded.',
  'Local extras: mcp__memory__search_nodes, mcp__time__get_current_time, mcp__documents__read_document for workspace attachments.',
  'Harbor Kiln is a trade team (acquire buyers, close orders), not a general coding agent. @member means list_agents then send_message or subagent. subagent description must be the roster 花名 (营销专家, not the task summary). Members report with 【花名】进行中|报错|完成.',
].join(' ')

const EDIT_NEEDS_READ_RE = /edit requires reading "([^"]+)" first/g
const WRITE_NEEDS_READ_RE = /cannot overwrite existing "([^"]+)" without reading/g
const STALE_EDIT_RE = /cannot edit "([^"]+)"[\s\S]*re-read the file, then retry/g

export function unreadEditPathsFromText(text) {
  const paths = new Set()
  const source = String(text || '')
  for (const match of source.matchAll(EDIT_NEEDS_READ_RE)) paths.add(match[1])
  for (const match of source.matchAll(WRITE_NEEDS_READ_RE)) paths.add(match[1])
  for (const match of source.matchAll(STALE_EDIT_RE)) paths.add(match[1])
  return [...paths]
}

export function buildObservationHint(text) {
  const source = String(text || '')
  const paths = unreadEditPathsFromText(source)
  const needsRead = paths.length > 0 || /read the file, then retry|re-read the file, then retry/.test(source)
  if (!needsRead) return ''
  const listed = (paths.length ? paths : ['(see path in the error above)']).map((path) => `- ${path}`).join('\n')
  return [
    '[runtime] Filesystem policy blocked edit/write: this session has not observed the file with the `read` tool.',
    'bash, cat, grep, and glob do NOT count as a read.',
    'Do not retry edit now. Immediately emit `read` for:',
    listed,
    'After `read` returns the file contents, emit exactly ONE `edit` for that file.',
    'Never fire many parallel edits on an unread file.',
  ].join('\n')
}

function messageLooksLikeToolResult(message) {
  if (!message || typeof message !== 'object') return false
  if (message.role === 'tool' || message.role === 'function') return true
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) return false
  const content = asText(message.content)
  return content.includes('<tool_result')
}

export function lastTurnIsToolResult(messages) {
  const list = Array.isArray(messages) ? messages : []
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i]
    if (!message || typeof message !== 'object') continue
    if (message.role === 'assistant') return false
    if (messageLooksLikeToolResult(message)) return true
    if (message.role === 'user') return false
  }
  return false
}

export function buildToolProtocolPrompt(tools) {
  const schemas = (tools || []).map(toolSchema).filter(Boolean)
  const catalog = schemas.map((schema) => {
    return `- ${schema.name}: ${schema.description}\n  parameters: ${JSON.stringify(schema.parameters)}`
  }).join('\n')
  return [
    'You are in a multi-step agent loop. One user message can require many tool rounds.',
    'Hidden reasoning / thinking is discarded and is NOT a tool call.',
    'When a tool is required, the visible completion MUST contain one or more <tool_call> JSON blocks, then stop generating.',
    '"Stop generating" only ends this model completion. The runtime will run the tools and call you again with <tool_result>.',
    'After <tool_result>, continue the same task with more <tool_call> blocks. Do not wait for the human.',
    'Never ask the user to reply 继续 / continue so you can write files or run the next command.',
    'Never stop after a single ls/read/bash inspection if the user asked you to implement, fix, or build something.',
    'Do not claim you already read a file or ran a command unless a <tool_result> is in this conversation.',
    'If the user asked to search, read files, due-diligence a buyer, dispatch teammates, or change the repo, you MUST call a tool in this completion. Prose plans are not executed.',
    'Exact format:',
    '<tool_call>',
    '{"name": "TOOL_NAME", "arguments": { }}',
    '</tool_call>',
    'Rules:',
    '- arguments must be a JSON object matching that tool\'s schema',
    '- read/write/edit require file_path (not path/file)',
    '- bash requires command and description (5-10 words; description is shown in the UI)',
    '- glob requires pattern; skill requires name',
    '- search the web with official web_search (DuckDuckGo, then Wikipedia). Put result titles and URLs in the reply. Extra engines: mcp__open-websearch__search. Official web_fetch is off; fetch URLs with mcp__web-search__web_fetch',
    '- buyer due diligence: OpenCorporates / OpenSanctions via mcp__buyer-dd__* plus web_search; never invent customs bills of lading',
    '- CRM: mcp__trade-crm__search_queries then web_search; upsert_lead with a public URL; capture_public_email on Impressum then send_outreach; quote_catalog reads store/data/catalog.json; record_reply updates the named buyer and writes team/deals/<id>.md',
    '- open data: mcp__trade-open-data__kickoff then dispatch 营销专家 even without @; comtrade_preview is country×HS totals not B/L; list_fairs is an open calendar',
    '- daily/weekly: schedule_create with every_seconds >= 300; only new root sessions after the schedule overlay',
    '- workspace attachments (pdf/docx/xlsx/md) via mcp__documents__read_document; local memory via mcp__memory__*; time zones via mcp__time__*',
    '- if the user @s a Harbor Kiln teammate, list_agents then send_message or subagent; do not do that person\'s job yourself',
    '- subagent description MUST be the roster 花名 (营销专家 / 建站专家 / …), never a task summary; that label is the sidebar and @ picker name',
    '- teammates report with report output like 【营销专家】进行中：… including errors',
    '- this team acquires buyers and closes orders; skip unknown skills and keep the loop in /workspace/team/',
    '- escape newlines inside JSON strings as \\n; keep the object valid JSON',
    '- multiple tools: multiple <tool_call> blocks',
    '- do not wrap the block in markdown fences',
    '- write/edit/bash/read are available in every round of this turn',
    '- before `edit` (or overwriting an existing file with `write`), call `read` on that exact path; bash/cat/grep do not observe the file',
    '- if edit errors with "requires reading" or "read the file, then retry", call `read` next — do not retry `edit`',
    '- one file: at most one `edit` per round; after a successful edit, re-read before another edit',
    '- if no tool is needed because the task is actually finished, answer normally with no <tool_call>',
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

  if (useProtocol && lastTurnIsToolResult(merged)) {
    const last = merged[merged.length - 1]
    const lastText = last && typeof last.content === 'string' ? last.content : ''
    const observation = buildObservationHint(lastText)
    const suffix = observation ? `${TOOL_CONTINUE_HINT}\n\n${observation}` : TOOL_CONTINUE_HINT
    if (last && typeof last.content === 'string') {
      last.content = `${last.content}\n\n${suffix}`
    } else {
      merged.push({ role: 'user', content: suffix })
    }
  }

  const out = { ...body, messages: merged }
  delete out.tools
  delete out.tool_choice
  delete out.parallel_tool_calls
  delete out.functions
  delete out.function_call
  if (useProtocol && isReasoningModel(out.model) && out.reasoning_effort == null) {
    out.reasoning_effort = 'low'
  }
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
 * 把助手正文写成 Harness 能看见的 OpenAI SSE / JSON。
 * GPT-5 常把字写进 reasoning_content，原样转发会触发 EMPTY_RESPONSE。
 */
export function encodeAssistantContent({ stream, upstream = {}, content, finishReason = 'stop' }) {
  const created = Number(upstream.created) || Math.floor(Date.now() / 1000)
  const base = {
    id: typeof upstream.id === 'string' ? upstream.id : `chatcmpl-proxy-${created}`,
    created,
    model: upstream.model || 'unknown',
    usage: upstream.usage,
  }
  const text = String(content ?? '')
  if (!stream) {
    return JSON.stringify({
      id: base.id,
      object: 'chat.completion',
      created: base.created,
      model: base.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: finishReason || 'stop',
      }],
      usage: base.usage,
    })
  }
  const chunks = [
    chunkTemplate(base, { role: 'assistant', content: '' }),
    chunkTemplate(base, { content: text }),
    chunkTemplate(base, {}, finishReason || 'stop'),
  ]
  if (base.usage) chunks[chunks.length - 1].usage = base.usage
  return sseEncode(chunks)
}

/**
 * 收集 OpenAI SSE / JSON 完成内容。同时记下 reasoning_content，
 * 因为 gpt-5.6-sol 经常 stop 且 content 为空。
 * @param {string} raw
 * @param {boolean} stream
 */
export function collectCompletion(raw, stream) {
  if (!stream) {
    const data = JSON.parse(raw)
    const choice = (data.choices || [])[0] || {}
    const message = choice.message || {}
    const content = asText(message.content)
    const reasoning = pickHiddenReasoning(message) || pickHiddenReasoning(choice)
    const refusal = asText(message.refusal)
    return {
      data,
      content,
      reasoning,
      refusal,
      nativeToolCalls: Array.isArray(message.tool_calls) && message.tool_calls.length > 0,
      finishReason: choice.finish_reason,
    }
  }

  let content = ''
  let reasoning = ''
  let refusal = ''
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
    reasoning += pickHiddenReasoning(delta) + pickHiddenReasoning(choice.message)
    refusal += asText(delta.refusal) + asText(choice.message?.refusal)
    if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) nativeToolCalls = true
    if (Array.isArray(choice.message?.tool_calls) && choice.message.tool_calls.length > 0) nativeToolCalls = true
    if (choice.finish_reason) finishReason = choice.finish_reason
  }
  return { data: acc, content, reasoning, refusal, nativeToolCalls, finishReason }
}

/**
 * content 为空时，把 reasoning / refusal 抬成可见正文，否则 Harness 会报 EMPTY_RESPONSE。
 * @param {ReturnType<typeof collectCompletion>} collected
 */
export function withLiftedReasoning(collected) {
  const content = String(collected?.content || '').trim()
  if (content) return { ...collected, lifted: false }
  const fallback = String(collected?.reasoning || '').trim() || String(collected?.refusal || '').trim()
  if (!fallback) return { ...collected, lifted: false }
  return { ...collected, content: fallback, lifted: true }
}

export function isEmptyAssistant(collected) {
  if (!collected) return true
  if (collected.nativeToolCalls) return false
  return !String(collected.content || '').trim()
}
