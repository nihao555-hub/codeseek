import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseAssistantToolPayload,
  toUpstreamChatBody,
  buildClientResponse,
  collectCompletion,
  sseEncode,
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
  assert.match(out.messages[0].content, /persona/)
  assert.match(out.messages[2].content, /<tool_call>/)
  assert.match(out.messages[3].content, /<tool_result/)
  assert.equal(out.messages[3].role, 'user')
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
