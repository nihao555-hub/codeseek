import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activitySnapshot, QUOTE_NOTE, REUSED_PLUGINS } from './trade-activity.mjs'

test('activity snapshot labels catalog quotes and lists public leads', () => {
  const data = activitySnapshot()
  assert.equal(data.quoteSource, 'store/data/catalog.json')
  assert.equal(data.quoteNote, QUOTE_NOTE)
  assert.ok(data.catalog.some((row) => row.sku === 'HK-TB-500-SS' && row.priceUsd === 12.8))
  assert.ok(Array.isArray(data.leads))
  assert.ok(Array.isArray(data.deals))
  assert.ok(data.summary.leads >= 1)
  const kitchen = data.leads.find((row) => /kitchenlab/i.test(row.company))
  if (kitchen) assert.match(kitchen.sourceUrl, /kitchenlab\.se/)
  assert.ok(REUSED_PLUGINS.some((row) => row.id === 'dsh-hud'))
  assert.ok(REUSED_PLUGINS.some((row) => row.id === 'dsh-better-sidebar'))
})
