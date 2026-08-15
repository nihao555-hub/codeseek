import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readDocument } from './documents.mjs'

test('readDocument extracts workspace markdown and rejects escape', () => {
  const previous = process.env.DSH_WORKSPACE
  const root = mkdtempSync(join(tmpdir(), 'codeseek-docs-'))
  process.env.DSH_WORKSPACE = root
  try {
    const file = join(root, 'rfq.md')
    writeFileSync(file, '# RFQ\nMOQ 500\n')
    const out = readDocument(file)
    assert.equal(out.kind, 'text')
    assert.match(out.text, /MOQ 500/)
    assert.throws(() => readDocument('/etc/passwd'), /outside workspace/)
  } finally {
    process.env.DSH_WORKSPACE = previous
    rmSync(root, { recursive: true, force: true })
  }
})
