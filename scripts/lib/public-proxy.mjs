/**
 * Loopback-preserving header rewrite for the public reverse proxy.
 * dsh's /api trust fence only accepts loopback Host (or trustedHosts);
 * rewriting Host + Origin to the local webserver lets a 0.0.0.0 listener
 * or a tunnel URL talk to 127.0.0.1:3080 without changing vendor.
 */
export function loopbackAuthority(host, port) {
  return `${host}:${port}`
}

export function rewriteProxyHeaders(headers, targetAuthority) {
  const out = { ...headers }
  out.host = targetAuthority
  if (typeof out.origin === 'string' && out.origin.length > 0 && out.origin !== 'null') {
    try {
      const originUrl = new URL(out.origin)
      out.origin = `${originUrl.protocol}//${targetAuthority}`
    } catch {
      out.origin = `http://${targetAuthority}`
    }
  }
  if (typeof out.referer === 'string' && out.referer.length > 0) {
    try {
      const refererUrl = new URL(out.referer)
      out.referer = `http://${targetAuthority}${refererUrl.pathname}${refererUrl.search}`
    } catch {
      // keep original referer if it is not a URL
    }
  }
  return out
}

export function isProxyHealthPath(pathname) {
  return pathname === '/__proxy_health'
}

export function isEventStreamPath(urlPath) {
  const path = String(urlPath || '').split('?')[0]
  return /\/plugins\/events(?:\/|$)/.test(path) || /\/api\/.*events/.test(path)
}

export function sseResponseHeaders(headers) {
  const out = {}
  for (const [key, value] of Object.entries(headers || {})) {
    if (value === undefined) continue
    const lower = key.toLowerCase()
    if (lower === 'content-length') continue
    out[lower] = value
  }
  out['cache-control'] = 'no-cache'
  out['x-accel-buffering'] = 'no'
  out.connection = 'keep-alive'
  if (!out['content-type']) out['content-type'] = 'text/event-stream'
  return out
}
