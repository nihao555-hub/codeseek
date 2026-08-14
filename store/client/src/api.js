const prefix = ''

async function req(path, options) {
  const res = await fetch(prefix + path, {
    headers: { 'content-type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `http_${res.status}`)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

export const api = {
  products: (params = {}) => {
    const q = new URLSearchParams(params)
    return req(`/api/products?${q}`)
  },
  product: (slug) => req(`/api/products/${slug}`),
  collections: () => req('/api/collections'),
  shipping: () => req('/api/shipping'),
  quote: (items) => req('/api/quote', { method: 'POST', body: JSON.stringify({ items }) }),
  checkout: (payload) => req('/api/checkout', { method: 'POST', body: JSON.stringify(payload) }),
  order: (id) => req(`/api/orders/${id}`),
  rfq: (payload) => req('/api/rfq', { method: 'POST', body: JSON.stringify(payload) }),
}
