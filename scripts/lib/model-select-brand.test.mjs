import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

test('home patch disables the DeepSeek official adapter', () => {
  const yaml = readFileSync(join(root, 'dsh-home/cordis.patch.yml'), 'utf8')
  assert.match(yaml, /- id: llm-deepseek\n  disabled: true/)
})

test('settings catalog only lists GRS Gemini and GPT seats', () => {
  const yaml = readFileSync(join(root, 'dsh-home/settings.yaml'), 'utf8')
  assert.match(yaml, /id: gemini-3\.5-flash/)
  assert.match(yaml, /id: gpt-5\.6-sol/)
  assert.doesNotMatch(yaml, /deepseek-chat|deepseek-reasoner|deepseek-v3/i)
})

test('ModelSelect override paints Gemini/OpenAI marks and hides DeepSeek rows', () => {
  const tsx = readFileSync(join(root, 'branding/overrides/ModelSelect.tsx'), 'utf8')
  assert.match(tsx, /function GeminiLogo/)
  assert.match(tsx, /function OpenAILogo/)
  assert.match(tsx, /id\.includes\('gemini'\)/)
  assert.match(tsx, /id\.includes\('gpt'\)/)
  assert.match(tsx, /hay\.includes\('deepseek'\)/)
  assert.match(tsx, /groupId === 'deepseek-official'/)
  assert.match(tsx, /<ModelLogo modelId=\{currentChoice\?\.model\.id/)
  assert.match(tsx, /<ModelLogo modelId=\{model\.id/)
})

test('apply-brand copies the ModelSelect override into the vendor client', () => {
  const sh = readFileSync(join(root, 'scripts/apply-brand.sh'), 'utf8')
  assert.match(sh, /overrides\/ModelSelect\.tsx/)
  assert.match(sh, /ui-model-selection\/src\/client\/ModelSelect\.tsx/)
  assert.match(sh, /overrides\/ModelSelect\.module\.css/)
})
