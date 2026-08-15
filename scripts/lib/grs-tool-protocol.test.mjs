import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseAssistantToolPayload,
  toUpstreamChatBody,
  buildClientResponse,
  collectCompletion,
  sseEncode,
  TOOL_CONTINUE_HINT,
  lastTurnIsToolResult,
  buildObservationHint,
  unreadEditPathsFromText,
  normalizeToolArguments,
  withLiftedReasoning,
  isEmptyAssistant,
  applyReasoningModelCompat,
  encodeAssistantContent,
  nudgeEmptyRetry,
  bumpReasoningBudget,
  canonicalRosterLabel,
  shouldRetryMissingToolCalls,
  userTurnExpectsTools,
  looksLikeSkippedToolCall,
  nudgeToolSkipRetry,
} from './grs-tool-protocol.mjs'

test('parses hermes <tool_call> json', () => {
  const text = '先看目录\n<tool_call>\n{"name":"bash","arguments":{"command":"ls /workspace/.dsh/skills"}}\n</tool_call>'
  const parsed = parseAssistantToolPayload(text)
  assert.equal(parsed.calls.length, 1)
  assert.equal(parsed.calls[0].name, 'bash')
  assert.equal(parsed.calls[0].arguments.command, 'ls /workspace/.dsh/skills')
  assert.equal(parsed.text, '先看目录')
})

test('parses multiple tool calls', () => {
  const text = '<tool_call>{"name":"read","arguments":{"file_path":"AGENTS.md"}}</tool_call>\n<tool_call>{"name":"read","arguments":{"file_path":"README.md"}}</tool_call>'
  const parsed = parseAssistantToolPayload(text)
  assert.equal(parsed.calls.map((c) => c.arguments.file_path).join(','), 'AGENTS.md,README.md')
})

test('parses tool_call JSON that contains raw newlines', () => {
  const text = `<tool_call>\n{"name":"write","arguments":{"file_path":"/workspace/tmp/a.md","content":"# Title\n\nHello"}}\n</tool_call>`
  const parsed = parseAssistantToolPayload(text)
  assert.equal(parsed.calls.length, 1)
  assert.equal(parsed.calls[0].name, 'write')
  assert.equal(parsed.calls[0].arguments.file_path, '/workspace/tmp/a.md')
  assert.match(parsed.calls[0].arguments.content, /Hello/)
})

test('parses fenced json fallback', () => {
  const text = '```tool_call\n{"name":"write","arguments":{"file_path":"tmp/a.md","content":"hi"}}\n```'
  const parsed = parseAssistantToolPayload(text)
  assert.equal(parsed.calls[0].name, 'write')
  assert.equal(parsed.calls[0].arguments.content, 'hi')
})

test('rewrites native tool messages into xml protocol', () => {
  const out = toUpstreamChatBody({
    model: 'gemini-3.5-flash',
    tools: [{ type: 'function', function: { name: 'bash', description: 'shell', parameters: { type: 'object' } } }],
    messages: [
      { role: 'system', content: 'persona' },
      { role: 'user', content: 'list files' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'bash', arguments: '{"command":"ls"}' } }],
      },
      { role: 'tool', tool_call_id: 'call_1', name: 'bash', content: 'a.md' },
    ],
  })
  assert.equal(out.tools, undefined)
  assert.match(out.messages[0].content, /Available tools/)
  assert.match(out.messages[0].content, /multi-step agent loop/)
  assert.match(out.messages[0].content, /persona/)
  assert.match(out.messages[2].content, /<tool_call>/)
  assert.match(out.messages[3].content, /<tool_result/)
  assert.match(out.messages[3].content, /Keep calling tools/)
  assert.equal(out.messages[3].role, 'user')
  assert.equal(lastTurnIsToolResult(out.messages), true)
  assert.equal(out.messages[3].content.includes(TOOL_CONTINUE_HINT), true)
})

test('does not nudge continue on a fresh user question', () => {
  const out = toUpstreamChatBody({
    model: 'gemini-3.5-flash',
    tools: [{ type: 'function', function: { name: 'bash', description: 'shell', parameters: { type: 'object' } } }],
    messages: [
      { role: 'system', content: 'persona' },
      { role: 'user', content: 'hello' },
    ],
  })
  assert.equal(lastTurnIsToolResult(out.messages), false)
  assert.equal(out.messages.at(-1).content.includes('[runtime]'), false)
})

test('protocol forbids asking the user to continue after one tool', () => {
  const out = toUpstreamChatBody({
    model: 'gemini-3.5-flash',
    tools: [{ type: 'function', function: { name: 'write', description: 'write file', parameters: { type: 'object' } } }],
    messages: [{ role: 'user', content: 'build the store' }],
  })
  assert.match(out.messages[0].content, /Never ask the user to reply/)
  assert.match(out.messages[0].content, /write\/edit\/bash\/read are available/)
  assert.match(out.messages[0].content, /bash\/cat\/grep do not observe the file/)
  assert.match(out.messages[0].content, /file_path \(not path\/file\)/)
  assert.match(out.messages[0].content, /bash requires command and description/)
  assert.match(out.messages[0].content, /skip unknown skills/)
})

test('extracts unread edit paths from harness FS_NOT_OBSERVED errors', () => {
  const text = 'Error: edit requires reading "/workspace/store/client/src/App.jsx" first -- read the file, then retry'
  assert.deepEqual(unreadEditPathsFromText(text), ['/workspace/store/client/src/App.jsx'])
  assert.match(buildObservationHint(text), /Do not retry edit now/)
  assert.match(buildObservationHint(text), /App\.jsx/)
})

test('observation error in tool result tells the model to read first', () => {
  const err = 'Error: edit requires reading "/workspace/store/client/src/App.jsx" first -- read the file, then retry'
  const out = toUpstreamChatBody({
    model: 'gemini-3.5-flash',
    tools: [
      { type: 'function', function: { name: 'edit', description: 'edit file', parameters: { type: 'object' } } },
      { type: 'function', function: { name: 'read', description: 'read file', parameters: { type: 'object' } } },
    ],
    messages: [
      { role: 'user', content: 'change App.jsx' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'edit', arguments: JSON.stringify({ file_path: '/workspace/store/client/src/App.jsx' }) },
        }],
      },
      {
        role: 'tool',
        tool_call_id: 'call_1',
        name: 'edit',
        content: err,
      },
    ],
  })
  const last = out.messages.at(-1).content
  assert.match(last, /Do not retry edit now/)
  assert.match(last, /App\.jsx/)
  assert.match(last, /Immediately emit/)
})

test('buildClientResponse stream has tool_calls finish', () => {
  const chunks = buildClientResponse({
    stream: true,
    upstream: { id: 'cmpl-1', created: 1, model: 'gemini-3.5-flash' },
    content: 'ok',
    calls: [{ name: 'bash', arguments: { command: 'echo hi' } }],
  })
  const last = chunks.at(-1)
  assert.equal(last.choices[0].finish_reason, 'tool_calls')
  const named = chunks.find((c) => c.choices[0].delta.tool_calls?.[0]?.function?.name)
  assert.equal(named.choices[0].delta.tool_calls[0].function.name, 'bash')
  assert.match(sseEncode(chunks), /data: \[DONE\]/)
})

test('normalizes common Gemini argument aliases', () => {
  assert.equal(
    normalizeToolArguments('read', { path: '/workspace/store/client/src/App.jsx' }).file_path,
    '/workspace/store/client/src/App.jsx',
  )
  assert.equal(normalizeToolArguments('read', { path: '/workspace/a.js' }).path, undefined)
  const bash = normalizeToolArguments('bash', { cmd: 'ls /workspace/store' })
  assert.equal(bash.command, 'ls /workspace/store')
  assert.equal(bash.description, 'ls /workspace/store')
  assert.equal(bash.cmd, undefined)
  assert.equal(
    normalizeToolArguments('glob', { glob_pattern: '**/*.jsx' }).pattern,
    '**/*.jsx',
  )
  assert.equal(normalizeToolArguments('skill', { skill: 'ecommerce-store' }).name, 'ecommerce-store')
  assert.equal(normalizeToolArguments('web_search', { q: 'searxng' }).query, 'searxng')
  assert.equal(normalizeToolArguments('mcp__web-search__web_fetch', { href: 'https://example.com' }).url, 'https://example.com')
})

test('parses invoke XML parameters and bare JSON tool calls', () => {
  const xml = '<invoke name="bash"><parameter name="command">ls /workspace/store</parameter></invoke>'
  const fromXml = parseAssistantToolPayload(xml)
  assert.equal(fromXml.calls[0].name, 'bash')
  assert.equal(fromXml.calls[0].arguments.command, 'ls /workspace/store')
  assert.match(fromXml.calls[0].arguments.description, /ls \/workspace\/store/)

  const bare = parseAssistantToolPayload('{"name":"read","arguments":{"path":"/workspace/AGENTS.md"}}')
  assert.equal(bare.calls[0].arguments.file_path, '/workspace/AGENTS.md')
})

test('recovers report tool_call JSON with raw newlines and quotes', () => {
  const text = `<tool_call> {"name":"report","arguments":{"output":"# 港窑审计
里面有 "缺陷" 和换行
"}}`
  const parsed = parseAssistantToolPayload(text)
  assert.equal(parsed.calls[0].name, 'report')
  assert.match(parsed.calls[0].arguments.output, /港窑审计/)
  assert.match(parsed.calls[0].arguments.output, /缺陷/)
})

test('protocol tells the model to use official web_search', () => {
  const out = toUpstreamChatBody({
    model: 'gemini-3.5-flash',
    tools: [{ type: 'function', function: { name: 'web_search', description: 'search', parameters: { type: 'object' } } }],
    messages: [{ role: 'user', content: 'search something' }],
  })
  assert.match(out.messages[0].content, /official web_search/)
  assert.match(out.messages[0].content, /mcp__web-search__web_fetch/)
  assert.doesNotMatch(out.messages[0].content, /do not call web_search/)
})

test('parses tool_call blocks that use argument aliases', () => {
  const text = [
    '<tool_call>{"name":"read","arguments":{"path":"/workspace/AGENTS.md"}}</tool_call>',
    '<tool_call>{"name":"bash","arguments":{"command":"ls /workspace/store"}}</tool_call>',
    '<tool_call>{"name":"glob","arguments":{"glob":"**/*"}}</tool_call>',
  ].join('\n')
  const parsed = parseAssistantToolPayload(text)
  assert.equal(parsed.calls[0].arguments.file_path, '/workspace/AGENTS.md')
  assert.equal(parsed.calls[1].arguments.command, 'ls /workspace/store')
  assert.match(parsed.calls[1].arguments.description, /ls \/workspace\/store/)
  assert.equal(parsed.calls[2].arguments.pattern, '**/*')
})

test('canonicalRosterLabel maps @handles to sidebar 花名', () => {
  assert.equal(canonicalRosterLabel('@营销'), '营销专家')
  assert.equal(canonicalRosterLabel('marketing'), '营销专家')
  assert.equal(canonicalRosterLabel('建站专家'), '建站专家')
  assert.equal(canonicalRosterLabel('背调'), '背调专员')
  assert.equal(canonicalRosterLabel('random'), '')
})

test('subagent aliases force roster 花名 into description', () => {
  const parsed = parseAssistantToolPayload(
    '<tool_call>{"name":"subagent","arguments":{"name":"营销专家","description":"找买家","prompt":"去挖客"}}</tool_call>',
  )
  assert.equal(parsed.calls[0].arguments.description, '营销专家')
  assert.match(parsed.calls[0].arguments.prompt, /找买家/)
  assert.match(parsed.calls[0].arguments.prompt, /去挖客/)
})

test('send_message and report argument aliases', () => {
  const parsed = parseAssistantToolPayload([
    '<tool_call>{"name":"send_message","arguments":{"id":"abc","text":"继续"}}</tool_call>',
    '<tool_call>{"name":"report","arguments":{"content":"【营销专家】完成：ok"}}</tool_call>',
  ].join('\n'))
  assert.equal(parsed.calls[0].arguments.subagent_id, 'abc')
  assert.equal(parsed.calls[0].arguments.message, '继续')
  assert.equal(parsed.calls[1].arguments.output, '【营销专家】完成：ok')
})

test('protocol tells the model to dispatch @ teammates', () => {
  const out = toUpstreamChatBody({
    model: 'gemini-3.5-flash',
    tools: [{ type: 'function', function: { name: 'subagent', description: 'delegate', parameters: { type: 'object' } } }],
    messages: [{ role: 'user', content: '@营销专家 找客' }],
  })
  assert.match(out.messages[0].content, /花名/)
  assert.match(out.messages[0].content, /list_agents/)
})

test('collectCompletion reads sse text', () => {
  const raw = [
    'data: {"choices":[{"delta":{"role":"assistant","content":"Hel"}}]}',
    'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}',
    'data: [DONE]',
  ].join('\n\n')
  const got = collectCompletion(raw, true)
  assert.equal(got.content, 'Hello')
  assert.equal(got.nativeToolCalls, false)
})

test('collectCompletion lifts reasoning_content when content is empty', () => {
  const raw = [
    'data: {"choices":[{"delta":{"role":"assistant","reasoning_content":"I should search"}}]}',
    'data: {"choices":[{"delta":{"reasoning_content":" for tumblers"},"finish_reason":"stop"}]}',
    'data: [DONE]',
  ].join('\n\n')
  const got = withLiftedReasoning(collectCompletion(raw, true))
  assert.equal(got.content, 'I should search for tumblers')
  assert.equal(got.lifted, true)
  assert.equal(isEmptyAssistant(got), false)
})

test('collectCompletion json reasoning_content can carry a tool_call', () => {
  const raw = JSON.stringify({
    id: 'cmpl-test',
    created: 1,
    model: 'gpt-5.6-sol',
    choices: [{
      message: {
        role: 'assistant',
        content: '',
        reasoning_content: '<tool_call>{"name":"web_search","arguments":{"query":"EU tumbler importer"}}</tool_call>',
      },
      finish_reason: 'stop',
    }],
  })
  const got = withLiftedReasoning(collectCompletion(raw, false))
  const parsed = parseAssistantToolPayload(got.content)
  assert.equal(parsed.calls[0].name, 'web_search')
  assert.match(parsed.calls[0].arguments.query, /tumbler/)
})

test('applyReasoningModelCompat remaps max_tokens for gpt-5', () => {
  const out = applyReasoningModelCompat({
    model: 'gpt-5.6-sol',
    max_tokens: 2048,
    messages: [],
  })
  assert.equal(out.max_completion_tokens, 2048)
  assert.equal(out.max_tokens, undefined)
  const gemini = applyReasoningModelCompat({ model: 'gemini-3.5-flash', max_tokens: 2048 })
  assert.equal(gemini.max_tokens, 2048)
  assert.equal(gemini.max_completion_tokens, undefined)
})

test('encodeAssistantContent writes visible SSE content', () => {
  const sse = encodeAssistantContent({
    stream: true,
    upstream: { id: 'cmpl-x', created: 1, model: 'gpt-5.6-sol' },
    content: 'visible',
  })
  assert.match(sse, /"content":"visible"/)
  assert.match(sse, /data: \[DONE\]/)
  const json = JSON.parse(encodeAssistantContent({
    stream: false,
    upstream: { id: 'cmpl-x', created: 1, model: 'gpt-5.6-sol' },
    content: 'visible',
  }))
  assert.equal(json.choices[0].message.content, 'visible')
})

test('nudgeEmptyRetry appends a user hint and bumpReasoningBudget raises the floor', () => {
  const nudged = nudgeEmptyRetry({ model: 'gpt-5.6-sol', messages: [{ role: 'user', content: 'hi' }] })
  assert.equal(nudged.messages.at(-1).role, 'user')
  assert.match(nudged.messages.at(-1).content, /empty visible content/)
  const bumped = bumpReasoningBudget({ model: 'gpt-5.6-sol', max_tokens: 512 })
  assert.equal(bumped.max_completion_tokens, 8192)
})

test('parses function_call and hermes function tags', () => {
  const fn = parseAssistantToolPayload('<function_call>{"name":"web_search","arguments":{"query":"OFAC tumbler"}}</function_call>')
  assert.equal(fn.calls[0].name, 'web_search')
  assert.equal(fn.calls[0].arguments.query, 'OFAC tumbler')
  const hermes = parseAssistantToolPayload('<function=read>{"file_path":"/workspace/team/roster.md"}</function>')
  assert.equal(hermes.calls[0].name, 'read')
  assert.equal(hermes.calls[0].arguments.file_path, '/workspace/team/roster.md')
})

test('retries when a trade task got prose instead of a tool call', () => {
  const messages = [{ role: 'user', content: '@营销专家 找北欧买家并背调' }]
  assert.equal(userTurnExpectsTools(messages), true)
  assert.equal(userTurnExpectsTools([{ role: 'user', content: '你好' }]), false)
  assert.equal(looksLikeSkippedToolCall('我先搜索一下北欧进口商'), true)
  assert.equal(shouldRetryMissingToolCalls({
    rewrite: true,
    messages,
    calls: [],
    content: '好的，我去找买家。',
  }), true)
  assert.equal(shouldRetryMissingToolCalls({
    rewrite: true,
    messages,
    calls: [{ name: 'web_search', arguments: { query: 'x' } }],
    content: '',
  }), false)
  const nudged = nudgeToolSkipRetry({ messages })
  assert.match(nudged.messages.at(-1).content, /no executable <tool_call>/)
})

test('gpt-5 tool protocol lowers reasoning effort so visible tool_call survives', () => {
  const out = toUpstreamChatBody({
    model: 'gpt-5.6-sol',
    tools: [{ type: 'function', function: { name: 'web_search', description: 'search', parameters: { type: 'object' } } }],
    messages: [{ role: 'user', content: 'search Nordic importers' }],
  })
  assert.equal(out.reasoning_effort, 'low')
  assert.match(out.messages[0].content, /Hidden reasoning/)
  assert.match(out.messages[0].content, /mcp__buyer-dd__/)
  assert.match(out.messages[0].content, /mcp__documents__read_document/)
  assert.match(out.messages[0].content, /mcp__trade-crm__/)
  assert.match(out.messages[0].content, /mcp__trade-open-data__/)
  assert.match(out.messages[0].content, /schedule_create/)
})
