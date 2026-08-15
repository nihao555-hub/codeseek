import { useEffect, useMemo, useState } from 'react'
import TeamDesk from './TeamDesk.jsx'
import { api } from './api.js'
import { loc, t } from './i18n.js'

const CART_KEY = 'hk-cart-v1'

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]')
  } catch {
    return []
  }
}

function thumbClass(product) {
  if (product.category === 'mug') return 'ember'
  if (product.category === 'gift') return ''
  return 'navy'
}

function ProductCard({ product, lang, onOpen, onAdd }) {
  return (
    <article className="card">
      <div className={`thumb ${thumbClass(product)}`} />
      <h3><a href={`#/p/${product.slug}`} onClick={(e) => { e.preventDefault(); onOpen(product.slug) }}>{loc(product.name, lang)}</a></h3>
      <p className="meta">{product.sku} · {product.certs.join(' / ')}</p>
      <div className="price">${product.priceUsd.toFixed(2)} <span className="meta">{t(lang, 'from')} · {t(lang, 'moq')} {product.moq}</span></div>
      <button className="btn" type="button" onClick={() => onAdd(product, 1)}>{t(lang, 'add')}</button>
    </article>
  )
}

export default function App() {
  const [lang, setLang] = useState('en')
  const [hash, setHash] = useState(window.location.hash || '#/')
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState({ q: '', category: '', cert: '', sort: 'featured' })
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cart, setCart] = useState(loadCart)
  const [cartOpen, setCartOpen] = useState(false)
  const [quote, setQuote] = useState(null)
  const [notice, setNotice] = useState('')
  const [order, setOrder] = useState(null)
  const [trackId, setTrackId] = useState('')
  const [form, setForm] = useState({ name: '', email: '', company: '', country: 'DE', incoterm: 'FOB Shenzhen' })
  const [rfq, setRfq] = useState({ email: '', message: '' })
  const [shipping, setShipping] = useState(null)

  const route = hash.replace(/^#/, '') || '/'

  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    let cancelled = false
    api.shipping()
      .then((data) => { if (!cancelled) setShipping(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  useEffect(() => {
    if (shipping?.terms?.length && !shipping.terms.includes(form.incoterm)) {
      setForm((current) => ({ ...current, incoterm: shipping.terms[0] }))
    }
  }, [shipping])

  useEffect(() => {
    if (!cartOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setCartOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cartOpen])

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
    if (cart.length === 0) {
      setQuote(null)
      return
    }
    api.quote(cart).then(setQuote).catch(() => setQuote(null))
  }, [cart])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    if (route === '/team') {
      setLoading(false)
      return () => { cancelled = true }
    }
    if (route.startsWith('/p/')) {
      api.product(route.slice(3))
        .then((d) => { if (!cancelled) setProduct(d.product) })
        .catch(() => { if (!cancelled) setProduct(null) })
        .finally(() => { if (!cancelled) setLoading(false) })
    } else {
      setProduct(null)
      api.products(query)
        .then((d) => { if (!cancelled) setProducts(d.products) })
        .catch((err) => { if (!cancelled) setError(err.message) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }
    return () => { cancelled = true }
  }, [route, query.q, query.category, query.cert, query.sort])

  const go = (path) => {
    window.location.hash = path
    setCartOpen(false)
  }

  const add = (p, qty) => {
    setCart((prev) => {
      const hit = prev.find((l) => l.productId === p.id)
      if (hit) return prev.map((l) => l.productId === p.id ? { ...l, qty: l.qty + qty } : l)
      return [...prev, { productId: p.id, qty, name: p.name, sku: p.sku, priceUsd: p.priceUsd }]
    })
    setCartOpen(true)
  }

  const setQty = (productId, qty) => {
    setCart((prev) => {
      if (qty < 1) return prev.filter((l) => l.productId !== productId)
      return prev.map((l) => l.productId === productId ? { ...l, qty } : l)
    })
  }

  const featured = useMemo(() => products.filter((p) => p.featured).slice(0, 3), [products])

  const checkout = async (e) => {
    e.preventDefault()
    try {
      const data = await api.checkout({
        items: cart,
        customer: form,
        incoterm: form.incoterm,
        shipping: { country: form.country },
      })
      setOrder(data.order)
      setCart([])
      setNotice(`${t(lang, 'orderOk')} ${data.order.id}`)
      go(`/order/${data.order.id}`)
    } catch (err) {
      setNotice(err.message)
    }
  }

  const sendRfq = async (e) => {
    e.preventDefault()
    await api.rfq({ ...rfq, lang })
    setNotice(t(lang, 'sent'))
    setRfq({ email: '', message: '' })
  }

  const lookup = async (e) => {
    e.preventDefault()
    try {
      const data = await api.order(trackId.trim().toUpperCase())
      setOrder(data.order)
      go(`/order/${data.order.id}`)
    } catch {
      setNotice('not_found')
    }
  }

  if (route === '/team') {
    return (
      <TeamDesk
        lang={lang}
        onBack={() => go('/')}
        onToggleLang={() => setLang(lang === 'en' ? 'zh' : 'en')}
      />
    )
  }

  return (
    <>
      <a className="skip" href="#main">{t(lang, 'skip')}</a>
      <div className="tide" />
      <header className="wrap top">
        <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); go('/') }}>
          <strong>{t(lang, 'brand')}</strong>
          <span>{t(lang, 'tag')}</span>
        </a>
        <nav className="nav">
          <a href="#/shop" onClick={(e) => { e.preventDefault(); go('/shop') }}>{t(lang, 'navShop')}</a>
          <a href="#/wholesale" onClick={(e) => { e.preventDefault(); go('/wholesale') }}>{t(lang, 'navWholesale')}</a>
          <a href="#/team" onClick={(e) => { e.preventDefault(); go('/team') }}>{t(lang, 'navTeam')}</a>
          <a href="#/track" onClick={(e) => { e.preventDefault(); go('/track') }}>{t(lang, 'navTrack')}</a>
          <a href="#/about" onClick={(e) => { e.preventDefault(); go('/about') }}>{t(lang, 'navAbout')}</a>
          <button className="lang" type="button" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>{lang === 'en' ? '中文' : 'EN'}</button>
          <button className="cart-btn" type="button" onClick={() => setCartOpen(true)}>{t(lang, 'cart')} ({cart.reduce((n, l) => n + l.qty, 0)})</button>
        </nav>
      </header>

      <main className="wrap" id="main">
        {notice && <p className="ok" role="status">{notice}</p>}
        {error && <p className="warn" role="alert">{error}</p>}
        {loading && <p className="meta" role="status">{t(lang, 'loading')}</p>}

        {route === '/' && (
          <>
            <section className="hero">
              <div>
                <div className="kicker">{t(lang, 'heroKicker')}</div>
                <h1>{t(lang, 'heroTitle')}</h1>
                <p>{t(lang, 'heroBody')}</p>
                <div className="actions">
                  <button className="btn" type="button" onClick={() => go('/shop')}>{t(lang, 'ctaShop')}</button>
                  <button className="btn ghost" type="button" onClick={() => go('/wholesale')}>{t(lang, 'ctaRfq')}</button>
                </div>
              </div>
              <div className="swatch"><b>500ml · CE</b></div>
            </section>
            {shipping && (
              <section className="section" aria-label={t(lang, 'shippingPolicyLabel')}>
                <p>{t(lang, 'shippingPolicy').replace('{amount}', `${shipping.currency} ${shipping.freeExportHandlingUsd}`)}</p>
                <p className="meta">{t(lang, 'shippingTerms').replace('{terms}', shipping.terms.join(' · '))}</p>
              </section>
            )}
            <section className="section">
              <h2>{t(lang, 'featured')}</h2>
              <div className="grid">
                {(featured.length ? featured : products.slice(0, 3)).map((p) => (
                  <ProductCard key={p.id} product={p} lang={lang} onOpen={(s) => go(`/p/${s}`)} onAdd={add} />
                ))}
              </div>
            </section>
            <section className="section">
              <h2>{t(lang, 'certs')}</h2>
              <p className="meta">CE · LFGB · FDA · dishwasher-safe — listed per SKU, never invented.</p>
            </section>
          </>
        )}

        {route === '/shop' && (
          <section className="section">
            <h2>{t(lang, 'shopTitle')}</h2>
            <div className="filters">
              <input value={query.q} placeholder={t(lang, 'search')} onChange={(e) => setQuery({ ...query, q: e.target.value })} />
              {['', 'tumbler', 'mug', 'bottle', 'gift'].map((c) => (
                <button key={c || 'all'} className={`chip ${query.category === c ? 'on' : ''}`} type="button" onClick={() => setQuery({ ...query, category: c })}>
                  {c || t(lang, 'all')}
                </button>
              ))}
              <select value={query.cert} onChange={(e) => setQuery({ ...query, cert: e.target.value })}>
                <option value="">{t(lang, 'filters')}</option>
                <option>CE</option>
                <option>FDA</option>
                <option>LFGB</option>
              </select>
              <select value={query.sort} onChange={(e) => setQuery({ ...query, sort: e.target.value })}>
                <option value="featured">featured</option>
                <option value="price-asc">price ↑</option>
                <option value="price-desc">price ↓</option>
                <option value="moq">MOQ</option>
              </select>
            </div>
            {products.length === 0 ? <p>{t(lang, 'empty')}</p> : (
              <div className="grid">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} lang={lang} onOpen={(s) => go(`/p/${s}`)} onAdd={add} />
                ))}
              </div>
            )}
          </section>
        )}

        {route.startsWith('/p/') && !loading && !product && (
          <section className="section">
            <p>{t(lang, 'notFound')}</p>
            <button className="btn" type="button" onClick={() => go('/shop')}>{t(lang, 'ctaShop')}</button>
          </section>
        )}

        {route.startsWith('/p/') && product && (
          <section className="section pdp">
            <div className={`thumb ${thumbClass(product)}`} style={{ minHeight: 320 }} role="img" aria-label={loc(product.name, lang)} />
            <div>
              <div className="kicker">{product.sku}</div>
              <h1>{loc(product.name, lang)}</h1>
              <p>{loc(product.tagline, lang)}</p>
              <p className="price">${product.priceUsd.toFixed(2)} USD</p>
              <p className="meta">{t(lang, 'moq')} {product.moq} · {t(lang, 'lead')} {product.leadDays}d · {product.incoterm} · {product.rating} / 5 · {product.reviewCount} {t(lang, 'reviews')}</p>
              <ul>{(product.specs[lang] || product.specs.en).map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="meta">{product.certs.join(' · ')} · {product.material} · {product.colors.join(', ')}</p>
              <div className="actions">
                <button className="btn" type="button" onClick={() => add(product, product.moq)}>{t(lang, 'add')} × {product.moq}</button>
                <button className="btn ghost" type="button" onClick={() => add(product, 1)}>{t(lang, 'add')} × 1</button>
              </div>
            </div>
          </section>
        )}

        {route === '/checkout' && (
          <section className="section">
            <h2>{t(lang, 'checkout')}</h2>
            <form className="form" onSubmit={checkout}>
              <input required placeholder={t(lang, 'name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input required type="email" placeholder={t(lang, 'email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input placeholder={t(lang, 'company')} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <input placeholder={t(lang, 'country')} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              <label>
                {t(lang, 'incoterm')}
                <select value={form.incoterm} onChange={(e) => setForm({ ...form, incoterm: e.target.value })}>
                  {(shipping?.terms?.length ? shipping.terms : ['FOB Shenzhen', 'FOB Ningbo']).map((term) => (
                    <option key={term}>{term}</option>
                  ))}
                </select>
              </label>
              {quote && <p>{t(lang, 'total')} ${quote.totalUsd}</p>}
              <button className="btn" type="submit">{t(lang, 'place')}</button>
            </form>
          </section>
        )}

        {route === '/wholesale' && (
          <section className="section">
            <h2>{t(lang, 'rfqTitle')}</h2>
            <p>{t(lang, 'rfqBody')}</p>
            <form className="form" onSubmit={sendRfq}>
              <input required type="email" placeholder={t(lang, 'email')} value={rfq.email} onChange={(e) => setRfq({ ...rfq, email: e.target.value })} />
              <textarea required rows={6} placeholder="300 pcs ceramic mug 350ml, FDA, FOB Ningbo, logo TBD" value={rfq.message} onChange={(e) => setRfq({ ...rfq, message: e.target.value })} />
              <button className="btn" type="submit">{t(lang, 'send')}</button>
            </form>
          </section>
        )}

        {route === '/track' && (
          <section className="section">
            <h2>{t(lang, 'navTrack')}</h2>
            <form className="form" onSubmit={lookup}>
              <input value={trackId} placeholder={t(lang, 'trackHint')} onChange={(e) => setTrackId(e.target.value)} />
              <button className="btn" type="submit">{t(lang, 'lookup')}</button>
            </form>
          </section>
        )}

        {route.startsWith('/order/') && order && (
          <section className="section">
            <h2>{order.id}</h2>
            <p>{order.status} · {order.incoterm} · {order.payment}</p>
            <p>{t(lang, 'total')} ${order.totalUsd}</p>
            {order.lines.map((l) => (
              <div className="line" key={l.sku}><span>{l.sku} × {l.qty}</span><span>${l.lineUsd}</span></div>
            ))}
          </section>
        )}

        {route === '/about' && (
          <section className="section">
            <h2>{t(lang, 'navAbout')}</h2>
            <p>{t(lang, 'about')}</p>
          </section>
        )}
      </main>

      {cartOpen && (
        <aside className="drawer" aria-label={t(lang, 'cart')} role="dialog" aria-modal="true">
          <h2>{t(lang, 'cart')}</h2>
          {cart.length === 0 && <p>{t(lang, 'cartEmpty')}</p>}
          {cart.map((l) => (
            <div className="line" key={l.productId}>
              <span>{l.sku}</span>
              <span className="qty">
                <button type="button" aria-label="−" onClick={() => setQty(l.productId, l.qty - 1)}>−</button>
                <span>{t(lang, 'qty')} {l.qty}</span>
                <button type="button" aria-label="+" onClick={() => setQty(l.productId, l.qty + 1)}>+</button>
                <button type="button" onClick={() => setQty(l.productId, 0)}>{t(lang, 'remove')}</button>
              </span>
            </div>
          ))}
          {quote && (
            <>
              {quote.lines.some((l) => l.belowMoq) && <p className="warn" role="status">{t(lang, 'belowMoq')}</p>}
              <p>{t(lang, 'subtotal')} ${quote.subtotal}</p>
              <p>{t(lang, 'shipping')} ${quote.shippingUsd}</p>
              <p>{t(lang, 'total')} ${quote.totalUsd}</p>
              <button className="btn" type="button" onClick={() => go('/checkout')}>{t(lang, 'checkout')}</button>
            </>
          )}
          <p><button className="lang" type="button" onClick={() => setCartOpen(false)}>{t(lang, 'close')}</button></p>
        </aside>
      )}

      <footer className="wrap foot">{t(lang, 'footer')}</footer>
    </>
  )
}
