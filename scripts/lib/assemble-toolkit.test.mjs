import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeToolkit, isMcpEnabled, loadCatalog, renderMcpPatch, fetchRemoteSkills } from '../assemble-toolkit.mjs'

test('catalog mcp ids and serverNames are unique and valid', () => {
  const catalog = loadCatalog()
  const ids = catalog.mcp.map((item) => item.id)
  assert.equal(ids.length, new Set(ids).size)
  for (const item of catalog.mcp) {
    assert.match(item.serverName || item.id, /^[A-Za-z0-9_-]{1,32}$/)
    assert.ok(item.transport === 'stdio' || item.transport === 'streamable-http')
  }
  const skillIds = catalog.skills.map((item) => item.id)
  assert.equal(skillIds.length, new Set(skillIds).size)
  assert.ok(catalog.mcp.length >= 15)
  assert.ok(catalog.skills.length >= 20)
})

test('renderMcpPatch disables servers unless forced or env', () => {
  const catalog = loadCatalog()
  const yaml = renderMcpPatch(catalog, { mcp: ['playwright'] })
  assert.match(yaml, /id: mcp-meta-ads/)
  assert.match(yaml, /serverName: meta-ads/)
  assert.match(yaml, /id: mcp-playwright/)
  assert.match(yaml, /id: mcp-searxng/)
  assert.match(yaml, /disabled: !!js "!\(true \|\| process\.env\.MCP_PLAYWRIGHT === '1'\)"/)
  assert.match(yaml, /disabled: !!js "!\(process\.env\.MCP_GITHUB === '1' \|\| Boolean\(process\.env\.GITHUB_TOKEN\)/)
  assert.match(yaml, /disabled: !!js "!\(process\.env\.MCP_SEARXNG === '1'\)"/)
  assert.match(yaml, /url: "https:\/\/mcp\.facebook\.com\/ads"/)
})

test('searxng env has public instance default and html fallback', () => {
  const catalog = loadCatalog()
  assert.ok(catalog.mcp.some((item) => item.id === 'searxng'))
  const yaml = renderMcpPatch(catalog, { mcp: ['searxng'] })
  assert.match(yaml, /id: mcp-searxng/)
  assert.match(yaml, /mcp-searxng/)
  assert.match(yaml, /SEARXNG_URL: !!js /)
  assert.match(yaml, /searx\.tiekoetter\.com/)
  assert.match(yaml, /SEARXNG_HTML_FALLBACK: !!js /)
  assert.match(yaml, /disabled: !!js "!\(true \|\| process\.env\.MCP_SEARXNG === '1'\)"/)
})

test('hostTools catalog lists DSH standard preset names', () => {
  const catalog = loadCatalog()
  const ids = new Set(catalog.hostTools.map((item) => item.id))
  for (const id of ['web_search', 'subagent', 'report', 'ralph', 'exit_plan_mode']) {
    assert.ok(ids.has(id), id)
  }
})

test('web-search local mcp is default-on via enabled patch', () => {
  const catalog = loadCatalog()
  assert.ok(catalog.mcp.some((item) => item.id === 'web-search'))
  const yaml = renderMcpPatch(catalog, { mcp: ['web-search'] })
  assert.match(yaml, /id: mcp-web-search/)
  assert.match(yaml, /serverName: web-search/)
  assert.match(yaml, /web-search-mcp\.mjs/)
  assert.match(yaml, /disabled: !!js "!\(true \|\| process\.env\.MCP_WEB_SEARCH === '1'\)"/)
  assert.match(yaml, /id: web-search-codeseek/)
  assert.match(yaml, /scripts\/web-search-provider\.mjs/)
})

test('open-websearch is default-on stdio MCP without Playwright', () => {
  const catalog = loadCatalog()
  assert.ok(catalog.mcp.some((item) => item.id === 'open-websearch'))
  const yaml = renderMcpPatch(catalog, { mcp: ['open-websearch'] })
  assert.match(yaml, /id: mcp-open-websearch/)
  assert.match(yaml, /serverName: open-websearch/)
  assert.match(yaml, /open-websearch-mcp\.mjs/)
  assert.match(yaml, /SEARCH_MODE: !!js "'request'"/)
  assert.match(yaml, /disabled: !!js "!\(true \|\| process\.env\.MCP_OPEN_WEBSEARCH === '1'\)"/)
})

test('local memory/time/documents MCP use NDJSON node scripts', () => {
  const catalog = loadCatalog()
  const ids = Object.fromEntries(catalog.mcp.map((item) => [item.id, item]))
  assert.equal(ids.memory.command, 'node')
  assert.equal(ids.time.command, 'node')
  assert.equal(ids.documents.command, 'node')
  const yaml = renderMcpPatch(catalog, { mcp: ['memory', 'time', 'documents'] })
  assert.match(yaml, /scripts\/memory-mcp\.mjs/)
  assert.match(yaml, /scripts\/time-mcp\.mjs/)
  assert.match(yaml, /scripts\/documents-mcp\.mjs/)
  assert.ok(Array.isArray(catalog.communityPlugins))
  assert.ok(catalog.communityPlugins.length >= 4)
})

test('default enabled.json turns on no-key MCP and leaves playwright off', () => {
  const enabled = JSON.parse(readFileSync(new URL('../../toolkit/enabled.json', import.meta.url), 'utf8'))
  for (const id of ['web-search', 'open-websearch', 'buyer-dd', 'memory', 'time', 'documents', 'sequential-thinking', 'context7']) {
    assert.ok(enabled.mcp.includes(id), id)
  }
  assert.ok(!enabled.mcp.includes('playwright'))
  assert.ok(!enabled.mcp.includes('puppeteer'))
  assert.ok(!enabled.mcp.includes('filesystem'))
})

test('describeToolkit marks forced MCP as enabled and lists host tools', () => {
  const catalog = loadCatalog()
  const data = describeToolkit(catalog, { mcp: ['documents'] }, {})
  const documents = data.mcp.find((row) => row.id === 'documents')
  const github = data.mcp.find((row) => row.id === 'github')
  assert.equal(documents.enabled, true)
  assert.equal(documents.forced, true)
  assert.equal(github.enabled, false)
  assert.equal(github.needsKey, true)
  assert.ok(data.hostTools.some((row) => row.id === 'web_search'))
  assert.match(data.restartHint, /重启/)
})

test('isMcpEnabled respects env flags and secrets', () => {
  const entry = { id: 'github', enableWhen: { flag: 'MCP_GITHUB', anyEnv: ['GITHUB_TOKEN'] } }
  assert.equal(isMcpEnabled(entry, { mcp: [] }, {}), false)
  assert.equal(isMcpEnabled(entry, { mcp: ['github'] }, {}), true)
  assert.equal(isMcpEnabled(entry, { mcp: [] }, { MCP_GITHUB: '1' }), true)
  assert.equal(isMcpEnabled(entry, { mcp: [] }, { GITHUB_TOKEN: 'x' }), true)
})

test('fetchRemoteSkills writes SKILL.md with whenToUse', async () => {
  const catalog = {
    skills: [{
      id: 'fixture-skill',
      kind: 'remote',
      whenToUse: '测试装配拉取。',
      source: { repo: 'example/skills', path: 'x/SKILL.md', license: 'MIT', url: 'https://example.test/SKILL.md' },
    }],
  }
  const fetchImpl = async () => ({
    ok: true,
    text: async () => '---\nname: old-name\ndescription: fixture\n---\n\n# Hello\n',
  })
  const destRoot = mkdtempSync(join(tmpdir(), 'codeseek-skills-'))
  try {
    const results = await fetchRemoteSkills(catalog, { fetchImpl, destRoot })
    assert.equal(results[0].ok, true)
    const body = readFileSync(join(destRoot, 'fixture-skill/SKILL.md'), 'utf8')
    assert.match(body, /^name: fixture-skill$/m)
    assert.match(body, /^whenToUse: /m)
    assert.match(body, /来源 example\/skills/)
  } finally {
    rmSync(destRoot, { recursive: true, force: true })
  }
})
