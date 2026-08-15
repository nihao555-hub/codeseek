import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { allProducts, collections, getBySlug, quoteItems, searchProducts } from './catalog.mjs'
import { createTeamDesk } from './team.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'client/dist')
const port = Number(process.env.STORE_PORT || 8788)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, {
    'content-type': headers['content-type'] || 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    ...headers,
  })
  res.end(payload)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function api(req, res, url, orders, rfqs, desk) {
  if (req.method === 'OPTIONS') {
    send(res, 204, '')
    return true
  }
  if (url.pathname === '/api/health') {
    send(res, 200, { ok: true, products: allProducts().length, service: 'harbor-kiln' })
    return true
  }
  if (url.pathname === '/api/shipping' && req.method === 'GET') {
    send(res, 200, {
      currency: 'USD',
      freeExportHandlingUsd: 500,
      terms: ['FOB Shenzhen', 'FOB Ningbo'],
    })
    return true
  }
  if (url.pathname === '/api/collections') {
    send(res, 200, { collections: collections() })
    return true
  }
  if (url.pathname === '/api/products') {
    const rows = searchProducts({
      q: url.searchParams.get('q') || '',
      category: url.searchParams.get('category') || '',
      cert: url.searchParams.get('cert') || '',
      sort: url.searchParams.get('sort') || 'featured',
    })
    send(res, 200, { products: rows, total: rows.length })
    return true
  }
  const productMatch = url.pathname.match(/^\/api\/products\/([a-z0-9-]+)$/)
  if (productMatch) {
    const product = getBySlug(productMatch[1])
    if (!product) {
      send(res, 404, { error: 'not_found' })
      return true
    }
    send(res, 200, { product })
    return true
  }
  if (url.pathname === '/api/quote' && req.method === 'POST') {
    return readJson(req).then((body) => {
      const quoted = quoteItems(body.items)
      if (quoted.error) send(res, quoted.status, quoted)
      else send(res, 200, quoted)
    }).catch(() => send(res, 400, { error: 'invalid_json' }))
  }
  if (url.pathname === '/api/checkout' && req.method === 'POST') {
    return readJson(req).then((body) => {
      const quoted = quoteItems(body.items)
      if (quoted.error) {
        send(res, quoted.status, quoted)
        return
      }
      const email = String(body.customer?.email || '').trim()
      if (!email.includes('@')) {
        send(res, 400, { error: 'email_required' })
        return
      }
      const id = `HK-${randomUUID().slice(0, 8).toUpperCase()}`
      const order = {
        id,
        status: 'awaiting_deposit',
        createdAt: new Date().toISOString(),
        customer: {
          name: body.customer?.name || '',
          email,
          country: body.customer?.country || '',
          company: body.customer?.company || '',
        },
        shipping: body.shipping || {},
        incoterm: body.incoterm || quoted.lines[0]?.incoterm || 'FOB Shenzhen',
        payment: 'T/T 30% deposit, 70% before shipment',
        ...quoted,
      }
      orders.set(id, order)
      send(res, 201, { order })
    }).catch(() => send(res, 400, { error: 'invalid_json' }))
  }
  const orderMatch = url.pathname.match(/^\/api\/orders\/([A-Z0-9-]+)$/)
  if (orderMatch && req.method === 'GET') {
    const order = orders.get(orderMatch[1])
    if (!order) send(res, 404, { error: 'not_found' })
    else send(res, 200, { order })
    return true
  }
  if (url.pathname === '/api/rfq' && req.method === 'POST') {
    return readJson(req).then((body) => {
      if (!body.email || !body.message) {
        send(res, 400, { error: 'email_and_message_required' })
        return
      }
      const id = `RFQ-${rfqs.length + 1}`
      rfqs.push({ id, ...body, createdAt: new Date().toISOString() })
      send(res, 201, { id, status: 'queued' })
    }).catch(() => send(res, 400, { error: 'invalid_json' }))
  }
  if (url.pathname === '/api/team' && req.method === 'GET') {
    const thread = url.searchParams.get('thread') || 'group'
    send(res, 200, desk.markRead(thread))
    return true
  }
  if (url.pathname === '/api/team/messages' && req.method === 'POST') {
    return readJson(req).then((body) => {
      const out = desk.post({ threadId: body.threadId || 'group', text: body.text })
      if (out.error) send(res, out.status || 400, out)
      else send(res, 201, out)
    }).catch(() => send(res, 400, { error: 'invalid_json' }))
  }
  return false
}

function serveStatic(req, res, url) {
  if (process.env.NODE_ENV !== 'production' && !existsSync(join(dist, 'index.html'))) {
    send(res, 503, { error: 'dev_mode', hint: 'Run npm run dev in store/ for Vite + API.' })
    return
  }
  let path = url.pathname === '/' ? '/index.html' : url.pathname
  let file = join(dist, path)
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html')
  const type = TYPES[extname(file)] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': type })
  createReadStream(file).pipe(res)
}

export function createHarborServer() {
  const orders = new Map()
  const rfqs = []
  const desk = createTeamDesk()
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
      const handled = api(req, res, url, orders, rfqs, desk)
      if (handled === true) return
      if (handled && typeof handled.then === 'function') {
        await handled
        return
      }
      if (url.pathname.startsWith('/api/')) {
        send(res, 404, { error: 'not_found' })
        return
      }
      serveStatic(req, res, url)
    } catch (err) {
      if (!res.headersSent) send(res, 500, { error: 'server', message: err instanceof Error ? err.message : String(err) })
    }
  })
}

const startedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (startedDirectly) {
  createHarborServer().listen(port, '127.0.0.1', () => {
    process.stderr.write(`[harbor-kiln] http://127.0.0.1:${port}\n`)
  })
}
