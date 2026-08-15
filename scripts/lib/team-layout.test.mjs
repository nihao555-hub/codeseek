import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../..')

test('trade team workspace has playbooks, templates and a sample deal', () => {
  const files = [
    'team/README.md',
    'team/roster.md',
    'team/company.md',
    'team/crm/leads.md',
    'team/crm/leads.json',
    'team/crm/deals.json',
    'team/pipeline.md',
    'team/playbooks/inquiry.md',
    'team/playbooks/quote.md',
    'team/playbooks/ops.md',
    'team/playbooks/compliance.md',
    'team/playbooks/marketing.md',
    'team/playbooks/social.md',
    'team/playbooks/site.md',
    'team/playbooks/wecom.md',
    'team/playbooks/loop.md',
    'team/playbooks/tools.md',
    'team/playbooks/due-diligence.md',
    'team/templates/due-diligence.md',
    'team/templates/inquiry-reply.en.md',
    'team/templates/quotation.md',
    'team/templates/deal.md',
    'team/templates/outreach.en.md',
    'team/templates/social-post.md',
    'team/templates/member-brief.md',
    'team/deals/HK-2026-001-nordic.md',
    '.dsh/skills/trade-marketing/SKILL.md',
    '.dsh/skills/trade-social/SKILL.md',
    '.dsh/skills/trade-desk/SKILL.md',
  ]
  for (const rel of files) {
    assert.equal(existsSync(join(root, rel)), true, rel)
  }
  const readme = readFileSync(join(root, 'team/README.md'), 'utf8')
  assert.match(readme, /trade-inquiry/)
  assert.match(readme, /trade-marketing/)
  assert.match(readme, /trade-social/)
  assert.match(readme, /catalog\.json/)
  assert.match(readme, /网易外贸通/)
  assert.match(readme, /营销专家/)
  assert.match(readme, /不必写 @|即使没 @|一句话即可/)
  assert.match(readme, /schedule_create|Comtrade|list_fairs/)
  const roster = readFileSync(join(root, 'team/roster.md'), 'utf8')
  assert.match(roster, /营销专家/)
  assert.match(roster, /背调专员/)
  assert.match(roster, /获客/)
  assert.match(roster, /成交/)
  assert.doesNotMatch(roster, /\| @开发 /)
  const pipeline = readFileSync(join(root, 'team/pipeline.md'), 'utf8')
  assert.match(pipeline, /HK-2026-001/)
})
