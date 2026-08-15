import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../..')

test('toolkit panel ships a DSH client bundle and overlay patch', () => {
  const client = readFileSync(join(root, 'plugins/toolkit-panel/lib/client.js'), 'utf8')
  const manifest = JSON.parse(readFileSync(join(root, 'plugins/toolkit-panel/package.json'), 'utf8'))
  const patch = readFileSync(join(root, 'plugins/toolkit-panel/cordis.patch.yml'), 'utf8')
  const start = readFileSync(join(root, 'scripts/start.sh'), 'utf8')
  assert.match(client, /window\.__ModuleLoader__\.load/)
  assert.match(client, /settings\.plugins\.tab/)
  assert.match(client, /工具与 MCP/)
  assert.equal(manifest.name, 'codeseek-toolkit-panel')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.match(patch, /id: codeseek-toolkit-panel/)
  assert.match(start, /toolkit-panel\/cordis\.patch\.yml/)
})
