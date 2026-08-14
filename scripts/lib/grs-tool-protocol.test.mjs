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
