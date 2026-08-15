#!/usr/bin/env node
/**
 * 读工作区内的询盘附件（文本 / docx / xlsx / pdf）。NDJSON。
 */
import { readDocument, workspaceRoot } from './lib/documents.mjs'
import { startStdioMcpServer } from './lib/mcp-stdio.mjs'

const TOOLS = [
  {
    name: 'read_document',
    description: 'Read a workspace file as text. Supports md/txt/csv/json/html/docx/xlsx/pdf. Path must be under the workspace root.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path under the workspace, e.g. /workspace/team/outbox/quote.md' },
      },
      required: ['path'],
    },
  },
]

startStdioMcpServer({
  name: 'documents',
  version: '1.0.0',
  tools: TOOLS,
  async call(name, args) {
    if (name === 'read_document') {
      const out = readDocument(args.path)
      return `workspace=${workspaceRoot()}\npath=${out.path}\nkind=${out.kind}\n\n${out.text}`
    }
    throw new Error(`Unknown tool: ${name}`)
  },
})
