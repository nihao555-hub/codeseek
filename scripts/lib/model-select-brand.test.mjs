import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('home patch disables the DeepSeek official adapter', () => {
  const yaml = readFileSync(join(root, 'dsh-home/cordis.patch.yml'), 'utf8')
  assert.match(yaml, /- id: llm-deepseek\n  disabled: true/)
  assert.match(yaml, /- id: web-search-deepseek\n  disabled: true/)
  assert.match(yaml, /searchProvider: codeseek-searxng/)
})

test('settings catalog only lists GRS Gemini and GPT seats', () => {
  const yaml = readFileSync(join(root, 'dsh-home/settings.yaml'), 'utf8')
  assert.match(yaml, /id: gemini-3\.5-flash/)
  assert.match(yaml, /id: gpt-5\.6-sol/)
  assert.doesNotMatch(yaml, /deepseek-chat|deepseek-reasoner|deepseek-v3/i)
})

test('ModelSelect override paints Gemini/OpenAI marks and hides DeepSeek rows', () => {
  const tsx = readFileSync(join(root, 'branding/overrides/ModelSelect.tsx'), 'utf8')
  assert.match(tsx, /\/brand\/models\/gemini\.svg/)
  assert.match(tsx, /function OpenAILogo/)
  assert.match(tsx, /M22\.2819 9\.8211/)
  assert.match(tsx, /id\.includes\('gemini'\)/)
  assert.match(tsx, /id\.includes\('gpt'\)/)
  assert.match(tsx, /hay\.includes\('deepseek'\)/)
  assert.match(tsx, /groupId === 'deepseek-official'/)
  assert.match(tsx, /<ModelLogo modelId=\{currentChoice\?\.model\.id/)
  assert.match(tsx, /<ModelLogo modelId=\{model\.id/)
})

test('apply-brand copies official model logos into the web public dir', () => {
  const sh = readFileSync(join(root, 'scripts/apply-brand.sh'), 'utf8')
  assert.match(sh, /svg\/model-gemini\.svg/)
  assert.match(sh, /brand\/models\/gemini\.svg/)
  assert.match(sh, /svg\/model-openai\.svg/)
  assert.match(sh, /brand\/models\/openai\.svg/)
  const gemini = readFileSync(join(root, 'branding/svg/model-gemini.svg'), 'utf8')
  const openai = readFileSync(join(root, 'branding/svg/model-openai.svg'), 'utf8')
  assert.match(gemini, /viewBox="0 0 65 65"/)
  assert.match(gemini, /#3186FF|#FC413D|#00B95C/)
  assert.match(openai, /M22\.2819 9\.8211/)
})

test('apply-brand copies the ModelSelect override into the vendor client', () => {
  const sh = readFileSync(join(root, 'scripts/apply-brand.sh'), 'utf8')
  assert.match(sh, /overrides\/ModelSelect\.tsx/)
  assert.match(sh, /ui-model-selection\/src\/client\/ModelSelect\.tsx/)
  assert.match(sh, /overrides\/ModelSelect\.module\.css/)
})

test('apply-brand restores the original empty-hero background', () => {
  const sh = readFileSync(join(root, 'scripts/apply-brand.sh'), 'utf8')
  assert.match(sh, /fill="#6187D8" fillOpacity="0\.08"/)
  assert.match(sh, /if overlay in css:/)
  assert.match(sh, /revert HeroShell hero-glow overlay/)
  assert.doesNotMatch(sh, /if "url\('\/brand\/hero-glow\.png'\)" not in css:/)
})

test('start.sh rebuilds the model-selection client plugin with the web frontend', () => {
  const sh = readFileSync(join(root, 'scripts/start.sh'), 'utf8')
  assert.match(sh, /@deepseek-ai\/dsh-client-ui-conversation run bundle/)
  assert.match(sh, /@deepseek-ai\/dsh-client-ui-model-selection run bundle/)
  assert.match(sh, /@deepseek-ai\/dsh-web-frontend run build/)
})

test('start.sh puts --patch before web app flags like --port', () => {
  const sh = readFileSync(join(root, 'scripts/start.sh'), 'utf8')
  assert.match(sh, /bin\.ts" web "\$\{patches\[@\]\}" "\$@"/)
  assert.match(sh, /patches\+=\(--patch "\$mcp_patch"\)/)
  assert.match(sh, /patches\+=\(--patch "\$ui_patch"\)/)
  assert.doesNotMatch(sh, /"\$@" --patch/)
})

test('start.sh registers the repo workspace before launching web', () => {
  const sh = readFileSync(join(root, 'scripts/start.sh'), 'utf8')
  assert.match(sh, /ensure_default_workspace/)
  assert.match(sh, /scripts\/ensure-workspace\.mjs/)
})
