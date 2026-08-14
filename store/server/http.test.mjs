import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHarborServer } from './index.mjs'

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

async function json(url, path, options) {
  const res = await fetch(url + path, options)
  const body = await res.json()
  return { status: res.status, body }
}

test('health, catalog, checkout and rfq round-trip', async (t) => {
  const server = createHarborServer()
  const url = await listen(server)
  t.after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))))

  const health = await json(url, '/api/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.ok, true)
  assert.equal(health.body.products, 6)

  const shipping = await json(url, '/api/shipping')
  assert.equal(shipping.status, 200)
  assert.deepEqual(shipping.body, {
    currency: 'USD',
    freeExportHandlingUsd: 500,
    terms: ['FOB Shenzhen', 'FOB Ningbo'],
  })

  const fda = await json(url, '/api/products?cert=FDA&category=mug')
  assert.ok(fda.body.products.length >= 1)
  assert.ok(fda.body.products.every((p) => p.certs.includes('FDA') && p.category === 'mug'))

  const missing = await json(url, '/api/products/no-such-cup')
  assert.equal(missing.status, 404)

  const quote = await json(url, '/api/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 'hk-mug-350', qty: 10 }] }),
  })
  assert.equal(quote.status, 200)
  assert.equal(quote.body.shippingUsd, 48)
  assert.equal(quote.body.lines[0].belowMoq, true)

  const checkout = await json(url, '/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'hk-tumbler-500', qty: 50 }],
      customer: { name: 'Alex Buyer', email: 'alex@example.co.uk', country: 'GB', company: 'North Sea Cups' },
      incoterm: 'FOB Shenzhen',
      shipping: { country: 'GB' },
    }),
  })
  assert.equal(checkout.status, 201)
  assert.match(checkout.body.order.id, /^HK-/)
  assert.equal(checkout.body.order.status, 'awaiting_deposit')

  const tracked = await json(url, `/api/orders/${checkout.body.order.id}`)
  assert.equal(tracked.status, 200)
  assert.equal(tracked.body.order.customer.email, 'alex@example.co.uk')

  const badRfq = await json(url, '/api/rfq', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'x@y.z' }),
  })
  assert.equal(badRfq.status, 400)

  const rfq = await json(url, '/api/rfq', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.de', message: '300 pcs HK-MG-350-CE, FDA, FOB Ningbo' }),
  })
  assert.equal(rfq.status, 201)
  assert.match(rfq.body.id, /^RFQ-/)
})
