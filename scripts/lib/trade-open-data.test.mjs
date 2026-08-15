import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  filterFairs,
  formatKickoff,
  kickoffPlan,
  parseComtradePreview,
  parseFairs,
  previewComtrade,
  resolveHs,
  resolveReporter,
  searchFairs,
} from './trade-open-data.mjs'

test('resolveReporter and HS map Nordics drinkware and electrical', () => {
  assert.equal(resolveReporter('Sweden'), '752')
  assert.equal(resolveReporter('北欧'), '752')
  assert.equal(resolveReporter('Indonesia'), '360')
  assert.equal(resolveHs('HK-TB-500-SS tumbler').hs, '9617')
  assert.equal(resolveHs('雅加达配电').hs, '8537')
  assert.equal(resolveHs('6912').hs, '6912')
})

test('parseComtradePreview maps official aggregate rows', () => {
  const rows = parseComtradePreview({
    data: [{
      period: '2024',
      reporterDesc: 'Sweden',
      partnerDesc: 'World',
      flowDesc: 'Import',
      cmdCode: '9617',
      cmdDesc: 'Vacuum flasks',
      primaryValue: 12345678,
      qty: 900,
      qtyUnitAbbr: 'NMB',
    }],
  })
  assert.equal(rows[0].hs, '9617')
  assert.equal(rows[0].usd, 12345678)
})

test('previewComtrade uses public preview URL and never claims bills of lading', async () => {
  const fetchImpl = async (url) => {
    assert.match(String(url), /comtradeapi\.un\.org\/public\/v1\/preview/)
    assert.match(String(url), /reporterCode=752/)
    assert.match(String(url), /cmdCode=9617/)
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ period: '2024', reporterDesc: 'Sweden', partnerDesc: 'World', flowCode: 'M', cmdCode: '9617', primaryValue: 1 }] }),
    }
  }
  const out = await previewComtrade({ market: 'Nordics', product: 'tumbler' }, { fetchImpl })
  assert.equal(out.ok, true)
  assert.match(out.text, /NOT bills of lading/i)
  assert.match(out.text, /Sweden/)
})

test('filterFairs keeps Ambiente and Canton Fair', () => {
  const rows = parseFairs([
    { name: 'Ambiente', country: 'Germany', city: 'Frankfurt', industry: 'Consumer Goods', start_date: '2026-01-30', end_date: '2026-02-03', website: 'https://ambiente.messefrankfurt.com/' },
    { name: 'CES', country: 'United States', city: 'Las Vegas', industry: 'Technology & Electronics', start_date: '2026-01-06', end_date: '2026-01-09' },
  ])
  const hits = filterFairs(rows, { q: 'ambiente' })
  assert.equal(hits.length, 1)
  assert.equal(hits[0].name, 'Ambiente')
})

test('searchFairs falls back to local snapshot when GitHub is down', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, text: async () => '' })
  const out = await searchFairs({ q: 'Ambiente' }, { fetchImpl })
  assert.match(out.source, /local snapshot|github/i)
  assert.match(out.text, /Ambiente|No matching|Trade fairs/)
})

test('kickoffPlan dispatches marketing immediately and skips ads/social/site', () => {
  const plan = kickoffPlan({ market: 'Nordics', product: 'tumbler', text: '帮我找北欧买家买保温杯然后成交' })
  assert.equal(plan.seats[0].name, '营销专家')
  assert.ok(plan.seats.some((row) => row.name === '报价专员'))
  assert.ok(plan.skip.includes('广告专员'))
  assert.match(formatKickoff(plan), /立刻派/)
})

test('one sentence without quote keywords only dispatches marketing', () => {
  const plan = kickoffPlan({ text: '帮我找北欧买家' })
  assert.deepEqual(plan.seats.map((row) => row.name), ['营销专家'])
  assert.ok(plan.skip.includes('社媒专家'))
})
