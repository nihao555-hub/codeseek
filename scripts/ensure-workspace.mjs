#!/usr/bin/env node
/**
 * 把 DSH_WORKSPACE（默认仓库根）写进 Harness 的 workspace 登记。
 * Web 选择器不会自动发现 /workspace；不登记的话会话会落到 / 或随便一个空目录。
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function emptyWorkspaceDoc() {
  return {
    unit: { name: 'workspace', version: 2 },
    global: { initialized: true, workspaceIds: [], archivedSessionIds: [] },
    tables: { workspaces: {} },
  }
}

/**
 * 保证 `path` 在登记里存在，并排到最前。空标题的 `/` 补成 "/"，避免选择器里出现无名项。
 */
export function ensureWorkspaceDoc(raw, { path, title, now } = {}) {
  const canonical = String(path || '').trim()
  if (!canonical) throw new Error('workspace path is required')
  const stamp = now || new Date().toISOString()
  const label = String(title || '').trim() || canonical.split('/').filter(Boolean).at(-1) || canonical

  let doc
  try {
    doc = raw ? JSON.parse(raw) : null
  } catch {
    doc = null
  }
  if (!doc || doc.unit?.name !== 'workspace') doc = emptyWorkspaceDoc()
  else doc = clone(doc)

  doc.unit = { name: 'workspace', version: 2 }
  doc.global ||= {}
  doc.global.initialized = true
  doc.global.workspaceIds = Array.isArray(doc.global.workspaceIds) ? [...doc.global.workspaceIds] : []
  doc.global.archivedSessionIds = Array.isArray(doc.global.archivedSessionIds) ? doc.global.archivedSessionIds : []
  doc.tables ||= {}
  doc.tables.workspaces ||= {}

  let id = Object.entries(doc.tables.workspaces).find(([, rec]) => rec && rec.path === canonical)?.[0]
  if (!id) {
    id = randomUUID()
    doc.tables.workspaces[id] = {
      path: canonical,
      title: label,
      sessionIds: [],
      createdAt: stamp,
      updatedAt: stamp,
    }
  } else {
    const rec = doc.tables.workspaces[id]
    if (!rec.title) rec.title = label
    rec.updatedAt = stamp
  }

  doc.global.workspaceIds = [id, ...doc.global.workspaceIds.filter((item) => item !== id)]

  for (const rec of Object.values(doc.tables.workspaces)) {
    if (rec && rec.path === '/' && !rec.title) rec.title = '/'
  }

  return { doc, id }
}

export function applyWorkspaceFile({ home, workspacePath, title } = {}) {
  const dshHome = home || process.env.DSH_HOME || join(ROOT, 'dsh-home')
  const target = workspacePath || process.env.DSH_WORKSPACE || ROOT
  const canonical = realpathSync(target)
  const file = join(dshHome, 'storages', 'workspace.json')
  mkdirSync(dirname(file), { recursive: true })
  const raw = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const { doc, id } = ensureWorkspaceDoc(raw, {
    path: canonical,
    title: title || 'codeseek',
  })
  writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`)
  return { file, id, path: canonical, title: doc.tables.workspaces[id].title }
}

function main() {
  const result = applyWorkspaceFile()
  process.stdout.write(`workspace ${result.path} (${result.title}) id=${result.id}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
