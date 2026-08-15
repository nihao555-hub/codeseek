#!/usr/bin/env node
/**
 * 装配超级员工的 skill / MCP / 主机工具。
 *
 *   node scripts/assemble-toolkit.mjs list
 *   node scripts/assemble-toolkit.mjs enable github playwright
 *   node scripts/assemble-toolkit.mjs disable playwright
 *   node scripts/assemble-toolkit.mjs sync
 *   node scripts/assemble-toolkit.mjs fetch-skills
 *   node scripts/assemble-toolkit.mjs refresh-mcp
 *   node scripts/assemble-toolkit.mjs doctor
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, lstatSync, readlinkSync, unlinkSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG_PATH = join(ROOT, 'toolkit/catalog.json')
const ENABLED_PATH = join(ROOT, 'toolkit/enabled.json')
const PATCH_PATH = join(ROOT, 'dsh-home/cordis.mcp.patch.yml')
const SKILLS_DIR = join(ROOT, '.dsh/skills')
const SNAPSHOT_PATH = join(ROOT, 'toolkit/mcp-registry.snapshot.json')
const SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/

export function loadCatalog() {
  return JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
}

export function loadEnabled() {
  if (!existsSync(ENABLED_PATH)) return { mcp: [] }
  const data = JSON.parse(readFileSync(ENABLED_PATH, 'utf8'))
  return { mcp: Array.isArray(data.mcp) ? data.mcp : [] }
}

export function saveEnabled(enabled) {
  const prev = loadEnabled()
  const next = {
    mcp: [...new Set(enabled.mcp)].sort(),
    note: enabled.note || prev.note || '把要强制打开的 MCP id 放进 mcp 数组，然后 npm run toolkit sync。',
  }
  writeFileSync(ENABLED_PATH, `${JSON.stringify(next, null, 2)}\n`)
  return next
}

export function localSkillNames() {
  return readdirSync(SKILLS_DIR).filter((name) => {
    const path = join(SKILLS_DIR, name)
    return statSync(path).isDirectory() && existsSync(join(path, 'SKILL.md'))
  })
}

function enableExpression(entry, forced) {
  const parts = []
  if (forced) parts.push('true')
  const flag = entry.enableWhen?.flag
  if (flag) parts.push(`process.env.${flag} === '1'`)
  for (const env of entry.enableWhen?.anyEnv || []) {
    parts.push(`Boolean(process.env.${env})`)
  }
  return parts.length ? parts.join(' || ') : 'false'
}

function jsStringLiteral(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

function envJs(spec) {
  const from = spec.from || []
  const chain = from.map((name) => `process.env.${name}`).join(' || ')
  const fallback = spec.default != null ? jsStringLiteral(spec.default) : "''"
  return chain ? `${chain} || ${fallback}` : fallback
}

function headerJs(headers) {
  const bearer = Object.entries(headers || {}).find(([, spec]) => spec && spec.bearer)
  if (!bearer) return '{}'
  const [headerName, spec] = bearer
  const env = spec.bearer
  return `process.env.${env} ? { ${JSON.stringify(headerName)}: 'Bearer ' + process.env.${env} } : {}`
}

function yamlScalar(value) {
  if (value && typeof value === 'object' && value.js) return `!!js ${JSON.stringify(value.js)}`
  const text = String(value)
  if (/[:#@&*!]|^\s|\s$|^$/.test(text) || text.includes("'")) return JSON.stringify(text)
  return text
}

export function renderMcpPatch(catalog, enabled) {
  const forced = new Set(enabled.mcp)
  const unknown = [...forced].filter((id) => !catalog.mcp.some((item) => item.id === id))
  if (unknown.length) throw new Error(`enabled.json 里有未知 MCP: ${unknown.join(', ')}`)

  const rows = []
  for (const entry of catalog.mcp) {
    const serverName = entry.serverName || entry.id
    if (!SERVER_NAME.test(serverName)) {
      throw new Error(`serverName 不合法: ${serverName}`)
    }
    const expr = enableExpression(entry, forced.has(entry.id))
    const timeout = ['meta-ads', 'playwright', 'searxng', 'web-search', 'open-websearch', 'documents'].includes(entry.id) ? 120000 : 60000
    const lines = [
      `    - id: mcp-${entry.id}`,
      `      name: '@deepseek-ai/dsh-mcp-client'`,
      `      disabled: !!js "!(${expr})"`,
      `      config:`,
      `        serverName: ${serverName}`,
      `        transport: ${entry.transport}`,
      `        toolCallTimeoutMs: ${timeout}`,
      `        failOnStartupError: false`,
    ]
    if (entry.transport === 'streamable-http') {
      lines.push(`        url: ${yamlScalar(entry.url)}`)
      lines.push(`        headers: !!js "${headerJs(entry.headers).replaceAll('"', '\\"')}"`)
    } else if (entry.transport === 'stdio') {
      lines.push(`        command: ${yamlScalar(entry.command)}`)
      lines.push(`        args:`)
      for (const arg of entry.args || []) {
        lines.push(`          - ${yamlScalar(arg)}`)
      }
      const envEntries = Object.entries(entry.env || {})
      if (envEntries.length) {
        lines.push(`        env:`)
        for (const [key, spec] of envEntries) {
          lines.push(`          ${key}: !!js ${JSON.stringify(envJs(spec))}`)
        }
      }
    } else {
      throw new Error(`不支持的 transport: ${entry.transport}`)
    }
    lines.push(`        reconnect:`)
    lines.push(`          enabled: true`)
    lines.push(`          initialDelayMs: 1000`)
    lines.push(`          maxDelayMs: 30000`)
    lines.push(`          maxAttempts: 10`)
    rows.push(lines.join('\n'))
  }

  const searchPlugin = join(ROOT, 'scripts/web-search-provider.mjs')
  rows.push([
    '    - id: web-search-codeseek',
    `      name: ${yamlScalar(searchPlugin)}`,
  ].join('\n'))

  return [
    '# 由 scripts/assemble-toolkit.mjs sync 生成。不要手改；改 toolkit/catalog.json 或 toolkit/enabled.json。',
    '# 每个 MCP 默认关闭：有对应密钥、或 MCP_<FLAG>=1、或写入 enabled.json 后才会加载。',
    '# 工具名形如 mcp__<serverName>__<rawName>。',
    '# web-search-codeseek 把官方 web_search 接到本地 SearXNG/DuckDuckGo。',
    '',
    '- insert:',
    ...rows,
    '',
  ].join('\n')
}

export function syncPatch(catalog = loadCatalog(), enabled = loadEnabled()) {
  mkdirSync(dirname(PATCH_PATH), { recursive: true })
  const yaml = renderMcpPatch(catalog, enabled)
  writeFileSync(PATCH_PATH, yaml)
  ensureToolkitPanelInstall()
  return PATCH_PATH
}

export const TOOLKIT_PANEL_PACKAGE = 'codeseek-toolkit-panel'
export const TOOLKIT_PANEL_DIR = join(ROOT, 'plugins/toolkit-panel')

function ensureSymlink(link, target) {
  mkdirSync(dirname(link), { recursive: true })
  try {
    const stat = lstatSync(link)
    if (stat.isSymbolicLink()) {
      if (readlinkSync(link) === target) return link
      unlinkSync(link)
    } else {
      throw new Error(`${link} 已存在且不是符号链接`)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  symlinkSync(target, link)
  return link
}

/**
 * Client 半边靠 package.json 的 dsh.client 扫描。overlay 必须用包名，
 * 并且这个包要从 web profile 的 node_modules 解析到。
 */
export function ensureToolkitPanelInstall(home = process.env.DSH_HOME || join(ROOT, 'dsh-home')) {
  const links = [
    ensureSymlink(join(home, 'profiles/web/node_modules', TOOLKIT_PANEL_PACKAGE), TOOLKIT_PANEL_DIR),
    ensureSymlink(join(home, 'profiles/node_modules', TOOLKIT_PANEL_PACKAGE), TOOLKIT_PANEL_DIR),
  ]
  const manifestPath = join(home, 'profiles/web/package.json')
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const spec = `file:${TOOLKIT_PANEL_DIR}`
    manifest.dependencies = manifest.dependencies || {}
    if (manifest.dependencies[TOOLKIT_PANEL_PACKAGE] !== spec) {
      manifest.dependencies[TOOLKIT_PANEL_PACKAGE] = spec
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    }
  }
  return links
}

function ensureWhenToUse(markdown, whenToUse) {
  if (/^whenToUse:/m.test(markdown)) return markdown
  if (!whenToUse) whenToUse = '在该 skill 的 description 匹配当前任务时使用。'
  return markdown.replace(/^---\n/, `---\nwhenToUse: ${whenToUse}\n`)
}

export async function fetchRemoteSkills(catalog = loadCatalog(), { only = [], fetchImpl = fetch, destRoot = SKILLS_DIR } = {}) {
  const want = new Set(only)
  const remotes = catalog.skills.filter((skill) => skill.kind === 'remote' && skill.source?.url)
  const selected = want.size ? remotes.filter((skill) => want.has(skill.id)) : remotes
  const results = []
  for (const skill of selected) {
    const res = await fetchImpl(skill.source.url)
    if (!res.ok) {
      results.push({ id: skill.id, ok: false, status: res.status })
      continue
    }
    let body = await res.text()
    if (!body.startsWith('---\n')) {
      results.push({ id: skill.id, ok: false, status: 'no-frontmatter' })
      continue
    }
    body = ensureWhenToUse(body, skill.whenToUse)
    body = body.replace(/^name: .+$/m, `name: ${skill.id}`)
    const dir = join(destRoot, skill.id)
    mkdirSync(dir, { recursive: true })
    const dest = join(dir, 'SKILL.md')
    const end = body.indexOf('\n---\n')
    const banner = `<!-- 来源 ${skill.source.repo} ${skill.source.path}（${skill.source.license || 'see upstream'}）。装配拉取，勿当本仓库原创。 -->\n`
    const withNote = end > 0
      ? `${body.slice(0, end + 5)}\n${banner}${body.slice(end + 5)}`
      : `${body}\n${banner}`
    writeFileSync(dest, withNote)
    const licenseUrl = skill.source.url.replace(/SKILL\.md$/, 'LICENSE.txt')
    if (licenseUrl !== skill.source.url) {
      const licenseRes = await fetchImpl(licenseUrl)
      if (licenseRes.ok) {
        writeFileSync(join(dir, 'LICENSE.txt'), await licenseRes.text())
      }
    }
    results.push({ id: skill.id, ok: true, path: dest, bytes: withNote.length })
  }
  return results
}

export async function refreshMcpSnapshot({ fetchImpl = fetch, queries = ['github', 'playwright', 'stripe', 'linear', 'notion', 'sentry', 'context7', 'filesystem', 'searxng'] } = {}) {
  const servers = []
  for (const query of queries) {
    const url = `https://registry.modelcontextprotocol.io/v0.1/servers?search=${encodeURIComponent(query)}&version=latest&limit=8`
    const res = await fetchImpl(url)
    if (!res.ok) continue
    const data = await res.json()
    for (const row of data.servers || []) {
      const server = row.server || {}
      servers.push({
        query,
        name: server.name,
        description: server.description,
        remotes: server.remotes,
        packages: server.packages,
      })
    }
  }
  const snapshot = { fetchedAt: new Date().toISOString(), count: servers.length, servers }
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`)
  return snapshot
}

export function isMcpEnabled(entry, enabled, env = process.env) {
  const forced = new Set(enabled.mcp || [])
  if (forced.has(entry.id)) return true
  if (entry.enableWhen?.flag && env[entry.enableWhen.flag] === '1') return true
  return (entry.enableWhen?.anyEnv || []).some((name) => Boolean(env[name]))
}

export function describeToolkit(catalog = loadCatalog(), enabled = loadEnabled(), env = process.env) {
  const forced = new Set(enabled.mcp || [])
  const skills = existsSync(SKILLS_DIR) ? localSkillNames() : []
  return {
    hostTools: catalog.hostTools,
    skills: catalog.skills.map((skill) => ({
      id: skill.id,
      kind: skill.kind,
      group: skill.group || null,
      description: skill.description || skill.whenToUse || '',
      installed: skills.includes(skill.id),
    })),
    mcp: catalog.mcp.map((entry) => {
      const keys = entry.enableWhen?.anyEnv || []
      const missingKeys = keys.filter((name) => !env[name])
      return {
        id: entry.id,
        title: entry.title,
        description: entry.description,
        transport: entry.transport,
        serverName: entry.serverName,
        docs: entry.docs || '',
        enabled: isMcpEnabled(entry, enabled, env),
        forced: forced.has(entry.id),
        needsKey: keys.length > 0,
        missingKeys,
        flag: entry.enableWhen?.flag || null,
        toolPrefix: `mcp__${entry.serverName || entry.id}__`,
      }
    }),
    communityPlugins: catalog.communityPlugins || [],
    note: enabled.note || '',
    restartHint: '开关 MCP 后必须重启 Web（scripts/start.sh web），设置页才会加载新工具。',
  }
}

export function setMcpEnabled(id, on, catalog = loadCatalog(), enabled = loadEnabled()) {
  if (!catalog.mcp.some((entry) => entry.id === id)) {
    throw new Error(`未知 MCP: ${id}`)
  }
  const mcp = new Set(enabled.mcp)
  if (on) mcp.add(id)
  else mcp.delete(id)
  const next = saveEnabled({ mcp: [...mcp], note: enabled.note })
  syncPatch(catalog, next)
  return describeToolkit(catalog, next)
}

function printList(catalog, enabled) {
  const forced = new Set(enabled.mcp)
  const installed = new Set(localSkillNames())
  console.log('== 主机工具（Harness 自带）==')
  for (const tool of catalog.hostTools) console.log(`  ${tool.id.padEnd(16)} ${tool.description}`)
  console.log('\n== Skills ==')
  for (const skill of catalog.skills) {
    const here = installed.has(skill.id) ? '已安装' : skill.kind === 'remote' ? '可拉取' : '缺失'
    console.log(`  ${skill.id.padEnd(24)} ${skill.kind.padEnd(7)} ${here}`)
  }
  console.log('\n== MCP（默认关闭，装配后才加载）==')
  for (const entry of catalog.mcp) {
    const flag = entry.enableWhen?.flag || ''
    const envs = (entry.enableWhen?.anyEnv || []).join('|')
    const on = forced.has(entry.id) ? 'enabled.json' : 'off'
    console.log(`  ${entry.id.padEnd(22)} ${on.padEnd(14)} flag=${flag || '-'} env=${envs || '-'}  ${entry.title}`)
  }
}

function printDoctor(catalog, enabled) {
  printList(catalog, enabled)
  console.log('\n== 本机密钥（只显示是否存在）==')
  const names = [...new Set(catalog.mcp.flatMap((item) => item.enableWhen?.anyEnv || []))]
  for (const name of names.sort()) {
    console.log(`  ${name}: ${process.env[name] ? '已设置' : '未设置'}`)
  }
  console.log(`\nMCP patch: ${existsSync(PATCH_PATH) ? PATCH_PATH : '尚未 sync'}`)
  console.log(`已安装 skill: ${localSkillNames().length}`)
  console.log('stdio MCP 协议: 换行 JSON-RPC（不是 LSP Content-Length）')
  console.log('活体探测: node scripts/probe-tools.mjs')
}

async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv
  const catalog = loadCatalog()
  let enabled = loadEnabled()
  switch (cmd) {
    case 'list':
      printList(catalog, enabled)
      break
    case 'enable': {
      if (!rest.length) throw new Error('用法: enable <mcp-id>...')
      enabled = saveEnabled({ mcp: [...enabled.mcp, ...rest] })
      syncPatch(catalog, enabled)
      console.log('已启用:', enabled.mcp.join(', ') || '(无)')
      break
    }
    case 'disable': {
      const drop = new Set(rest)
      enabled = saveEnabled({ mcp: enabled.mcp.filter((id) => !drop.has(id)) })
      syncPatch(catalog, enabled)
      console.log('当前强制启用:', enabled.mcp.join(', ') || '(无)')
      break
    }
    case 'sync':
      console.log(syncPatch(catalog, enabled))
      break
    case 'fetch-skills': {
      const only = rest[0] === '--only' ? rest.slice(1) : []
      const results = await fetchRemoteSkills(catalog, { only })
      for (const row of results) {
        console.log(row.ok ? `ok ${row.id} ${row.bytes}B` : `fail ${row.id} ${row.status}`)
      }
      break
    }
    case 'refresh-mcp': {
      const snapshot = await refreshMcpSnapshot()
      console.log(`写入 ${SNAPSHOT_PATH} （${snapshot.count} 条）`)
      break
    }
    case 'doctor':
    case 'status':
      printDoctor(catalog, enabled)
      break
    default:
      console.log(`用法:
  node scripts/assemble-toolkit.mjs list
  node scripts/assemble-toolkit.mjs enable github playwright sequential-thinking
  node scripts/assemble-toolkit.mjs disable playwright
  node scripts/assemble-toolkit.mjs sync
  node scripts/assemble-toolkit.mjs fetch-skills [--only id...]
  node scripts/assemble-toolkit.mjs refresh-mcp
  node scripts/assemble-toolkit.mjs doctor`)
      if (cmd) process.exitCode = 1
  }
}

const startedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (startedDirectly) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
