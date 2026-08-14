import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(join(root, 'data/catalog.json'), 'utf8'))

export function allProducts() {
  return catalog
}

export function getBySlug(slug) {
  return catalog.find((p) => p.slug === slug) || null
}

export function searchProducts({ q = '', category = '', cert = '', sort = 'featured' } = {}) {
  const query = q.trim().toLowerCase()
  let rows = catalog.filter((p) => {
    if (category && p.category !== category) return false
    if (cert && !p.certs.includes(cert)) return false
    if (!query) return true
    const hay = [p.sku, p.name.en, p.name.zh, p.tagline.en, p.material, ...p.certs].join(' ').toLowerCase()
    return hay.includes(query)
  })
  if (sort === 'price-asc') rows = [...rows].sort((a, b) => a.priceUsd - b.priceUsd)
  else if (sort === 'price-desc') rows = [...rows].sort((a, b) => b.priceUsd - a.priceUsd)
  else if (sort === 'moq') rows = [...rows].sort((a, b) => a.moq - b.moq)
  else rows = [...rows].sort((a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating)
  return rows
}

export function quoteItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'cart_empty', status: 400 }
  }
  const lines = []
  let subtotal = 0
  for (const item of items) {
    const product = catalog.find((p) => p.id === item.productId)
    if (!product) return { error: 'unknown_sku', status: 400, productId: item.productId }
    const qty = Number(item.qty)
    if (!Number.isInteger(qty) || qty < 1) return { error: 'bad_qty', status: 400 }
    if (qty > product.stock) return { error: 'out_of_stock', status: 409, sku: product.sku }
    const line = {
      productId: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      qty,
      unitUsd: product.priceUsd,
      lineUsd: Number((product.priceUsd * qty).toFixed(2)),
      belowMoq: qty < product.moq,
      moq: product.moq,
      incoterm: product.incoterm,
    }
    subtotal += line.lineUsd
    lines.push(line)
  }
  const shippingUsd = subtotal >= 500 ? 0 : 48
  const totalUsd = Number((subtotal + shippingUsd).toFixed(2))
  return { lines, subtotal: Number(subtotal.toFixed(2)), shippingUsd, totalUsd }
}

export function collections() {
  const cats = [...new Set(catalog.map((p) => p.category))]
  return cats.map((id) => ({
    id,
    count: catalog.filter((p) => p.category === id).length,
  }))
}
