import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../../.dsh/skills')
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

test('every project skill has matching kebab-case frontmatter', () => {
  const names = readdirSync(root).filter((name) => {
    const path = join(root, name)
    return statSync(path).isDirectory() && !name.startsWith('.')
  })
  assert.ok(names.length >= 10, `expected many skills, got ${names.length}`)
  for (const name of names) {
    assert.match(name, KEBAB)
    const body = readFileSync(join(root, name, 'SKILL.md'), 'utf8')
    assert.equal(body.startsWith('---\n'), true, name)
    const end = body.indexOf('\n---\n', 4)
    assert.ok(end > 0, name)
    const fm = body.slice(4, end)
    assert.match(fm, new RegExp(`^name: ${name}$`, 'm'))
    assert.match(fm, /^description: .+/m)
    assert.match(fm, /^whenToUse: .+/m)
  }
})
