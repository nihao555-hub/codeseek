import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ensureActivityPanelInstall, ensureHarborTradeInstall, ensureToolkitPanelInstall, ACTIVITY_PANEL_DIR, ACTIVITY_PANEL_PACKAGE, HARBOR_TRADE_DIR, HARBOR_TRADE_PACKAGE, TOOLKIT_PANEL_DIR, TOOLKIT_PANEL_PACKAGE } from '../assemble-toolkit.mjs'

const root = join(import.meta.dirname, '../..')

test('toolkit panel ships a DSH client bundle and overlay patch', () => {
  const client = readFileSync(join(root, 'plugins/toolkit-panel/lib/client.js'), 'utf8')
  const host = readFileSync(join(root, 'plugins/toolkit-panel/src/index.mjs'), 'utf8')
  const manifest = JSON.parse(readFileSync(join(root, 'plugins/toolkit-panel/package.json'), 'utf8'))
  const patch = readFileSync(join(root, 'plugins/toolkit-panel/cordis.patch.yml'), 'utf8')
  const start = readFileSync(join(root, 'scripts/start.sh'), 'utf8')
  assert.match(client, /window\.__ModuleLoader__\.load/)
  assert.match(client, /settings\.plugins\.tab/)
  assert.match(client, /工具与 MCP/)
  assert.match(host, /realpathSync/)
  assert.match(host, /assemble-toolkit\.mjs/)
  assert.doesNotMatch(host, /from '\.\.\/\.\.\/scripts\/assemble-toolkit\.mjs'/)
  assert.equal(manifest.name, TOOLKIT_PANEL_PACKAGE)
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.dsh.client.immediately, true)
  assert.match(manifest.exports['./client'], /lib\/client\.js/)
  assert.match(patch, /^\s+name: codeseek-toolkit-panel\s*$/m)
  assert.doesNotMatch(patch, /toolkit-panel\/src\/index\.mjs/)
  assert.match(start, /toolkit-panel\/cordis\.patch\.yml/)
  assert.equal(existsSync(join(root, 'plugins/toolkit-panel/index.mjs')), true)
})

test('activity panel ships a DSH client overlay for the right rail', () => {
  const client = readFileSync(join(root, 'plugins/activity-panel/lib/client.js'), 'utf8')
  const host = readFileSync(join(root, 'plugins/activity-panel/src/index.mjs'), 'utf8')
  const manifest = JSON.parse(readFileSync(join(root, 'plugins/activity-panel/package.json'), 'utf8'))
  const patch = readFileSync(join(root, 'plugins/activity-panel/cordis.patch.yml'), 'utf8')
  const start = readFileSync(join(root, 'scripts/start.sh'), 'utf8')
  assert.match(client, /window\.__ModuleLoader__\.load/)
  assert.match(client, /shell\.overlay/)
  assert.match(client, /conversation\.input\.left/)
  assert.match(client, /__codeseek\/activity/)
  assert.match(client, /港窑实时/)
  assert.match(host, /trade-activity\.mjs/)
  assert.equal(manifest.name, ACTIVITY_PANEL_PACKAGE)
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.match(patch, /^\s+name: codeseek-activity-panel\s*$/m)
  assert.match(start, /activity-panel\/cordis\.patch\.yml/)
  assert.match(start, /activity_patch=/)
  assert.equal(existsSync(join(root, 'plugins/activity-panel/index.mjs')), true)
})

test('activity panel host serves CRM snapshot', async () => {
  const mod = await import(pathToFileURL(join(root, 'plugins/activity-panel/src/index.mjs')).href)
  assert.equal(mod.name, 'codeseek-activity-panel')
  assert.deepEqual(mod.inject, ['webServer'])
  const data = mod.activitySnapshot()
  assert.equal(data.quoteSource, 'store/data/catalog.json')
  assert.ok(data.catalog.some((row) => row.sku === 'HK-TB-500-SS'))
})

test('toolkit panel host module loads assemble-toolkit', async () => {
  const mod = await import(pathToFileURL(join(root, 'plugins/toolkit-panel/src/index.mjs')).href)
  assert.equal(mod.name, 'codeseek-toolkit-panel')
  assert.deepEqual(mod.inject, ['webServer'])
  assert.equal(typeof mod.apply, 'function')
})

test('ensureToolkitPanelInstall links the package into web profile node_modules', () => {
  const home = mkdtempSync(join(tmpdir(), 'codeseek-dsh-home-'))
  try {
    mkdirSync(join(home, 'profiles/web'), { recursive: true })
    writeFileSync(join(home, 'profiles/web/package.json'), `${JSON.stringify({
      name: 'dsh-profile-web',
      private: true,
      dependencies: {},
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
    }, null, 2)}\n`)
    const links = ensureToolkitPanelInstall(home)
    assert.equal(readlinkSync(links[0]), TOOLKIT_PANEL_DIR)
    assert.equal(readlinkSync(links[1]), TOOLKIT_PANEL_DIR)
    const manifest = JSON.parse(readFileSync(join(home, 'profiles/web/package.json'), 'utf8'))
    assert.equal(manifest.dependencies[TOOLKIT_PANEL_PACKAGE], `file:${TOOLKIT_PANEL_DIR}`)
    assert.equal(existsSync(join(links[0], 'package.json')), true)
    assert.equal(existsSync(join(links[0], 'lib/client.js')), true)
    const harbor = ensureHarborTradeInstall(home)
    assert.equal(readlinkSync(harbor[0]), HARBOR_TRADE_DIR)
    const activity = ensureActivityPanelInstall(home)
    assert.equal(readlinkSync(activity[0]), ACTIVITY_PANEL_DIR)
    const webManifest = JSON.parse(readFileSync(join(home, 'profiles/web/package.json'), 'utf8'))
    assert.equal(webManifest.dependencies[HARBOR_TRADE_PACKAGE], `file:${HARBOR_TRADE_DIR}`)
    assert.equal(webManifest.dependencies[ACTIVITY_PANEL_PACKAGE], `file:${ACTIVITY_PANEL_DIR}`)
    const bundle = JSON.parse(readFileSync(join(root, 'plugins/harbor-trade/package.json'), 'utf8'))
    assert.equal(bundle.dsh.bundle.patch, './cordis.patch.yml')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
