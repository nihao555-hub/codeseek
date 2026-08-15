import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../..')

test('trade team workspace has playbooks, templates and a sample deal', () => {
  const files = [
    'team/README.md',
    'team/company.md',
    'team/pipeline.md',
    'team/playbooks/inquiry.md',
    'team/playbooks/quote.md',
    'team/playbooks/ops.md',
    'team/playbooks/compliance.md',
    'team/templates/inquiry-reply.en.md',
    'team/templates/quotation.md',
    'team/templates/deal.md',
    'team/deals/HK-2026-001-nordic.md',
  ]
  for (const rel of files) {
    assert.equal(existsSync(join(root, rel)), true, rel)
  }
  const readme = readFileSync(join(root, 'team/README.md'), 'utf8')
  assert.match(readme, /trade-inquiry/)
  assert.match(readme, /catalog\.json/)
  const pipeline = readFileSync(join(root, 'team/pipeline.md'), 'utf8')
  assert.match(pipeline, /HK-2026-001/)
})
