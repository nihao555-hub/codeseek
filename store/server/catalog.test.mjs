import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quoteItems, searchProducts, getBySlug } from './catalog.mjs'

test('search filters by cert and category', () => {
  const fdaMugs = searchProducts({ category: 'mug', cert: 'FDA' })
  assert.ok(fdaMugs.length >= 1)
  assert.ok(fdaMugs.every((p) => p.category === 'mug' && p.certs.includes('FDA')))
})

test('quote rejects empty cart', () => {
  const q = quoteItems([])
  assert.equal(q.error, 'cart_empty')
})

test('quote applies free shipping over 500', () => {
  const product = getBySlug('stackable-mug-300')
  const q = quoteItems([{ productId: product.id, qty: 200 }])
  assert.equal(q.shippingUsd, 0)
  assert.equal(q.lines[0].belowMoq, true)
})

test('quote flags below MOQ', () => {
  const product = getBySlug('ceramic-mug-350')
  const q = quoteItems([{ productId: product.id, qty: 10 }])
  assert.equal(q.lines[0].belowMoq, true)
  assert.equal(q.shippingUsd, 48)
})
