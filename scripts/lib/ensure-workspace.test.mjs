import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ensureWorkspaceDoc } from '../ensure-workspace.mjs'

test('creates a registry with the repo workspace first', () => {
  const { doc, id } = ensureWorkspaceDoc('', {
    path: '/workspace',
    title: 'codeseek',
    now: '2026-08-14T00:00:00.000Z',
  })
  assert.equal(doc.global.initialized, true)
  assert.deepEqual(doc.global.workspaceIds, [id])
  assert.equal(doc.tables.workspaces[id].path, '/workspace')
  assert.equal(doc.tables.workspaces[id].title, 'codeseek')
})

test('moves an existing workspace to the front and names a blank root', () => {
  const raw = JSON.stringify({
    unit: { name: 'workspace', version: 2 },
    global: {
      initialized: true,
      workspaceIds: ['root-id', 'ws-id'],
      archivedSessionIds: [],
    },
    tables: {
      workspaces: {
        'root-id': {
          path: '/',
          title: '',
          sessionIds: ['session-a'],
          createdAt: '2026-08-14T00:00:00.000Z',
          updatedAt: '2026-08-14T00:00:00.000Z',
        },
        'ws-id': {
          path: '/workspace',
          title: 'codeseek',
          sessionIds: [],
          createdAt: '2026-08-14T00:00:00.000Z',
          updatedAt: '2026-08-14T00:00:00.000Z',
        },
      },
    },
  })
  const { doc, id } = ensureWorkspaceDoc(raw, { path: '/workspace', title: 'codeseek' })
  assert.equal(id, 'ws-id')
  assert.deepEqual(doc.global.workspaceIds, ['ws-id', 'root-id'])
  assert.equal(doc.tables.workspaces['root-id'].title, '/')
  assert.deepEqual(doc.tables.workspaces['root-id'].sessionIds, ['session-a'])
})
