#!/usr/bin/env node
/**
 * Bind 0.0.0.0 and forward HTTP + WebSocket to the loopback dsh webserver.
 * Usage: node scripts/public-proxy.mjs
 * Env: DSH_PUBLIC_HOST, DSH_PUBLIC_PORT, DSH_PORT (upstream 127.0.0.1)
 */
import http from 'node:http'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { isProxyHealthPath, loopbackAuthority, rewriteProxyHeaders } from './lib/public-proxy.mjs'

const listenHost = process.env.DSH_PUBLIC_HOST || '0.0.0.0'
const listenPort = Number(process.env.DSH_PUBLIC_PORT || 3081)
const targetHost = '127.0.0.1'
const targetPort = Number(process.env.DSH_PORT || 3080)
const targetAuthority = loopbackAuthority(targetHost, targetPort)

function hopByHopHeaders() {
  return new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ])
}

function forwardHeaders(headers) {
  const skip = hopByHopHeaders()
  const rewritten = rewriteProxyHeaders(headers, targetAuthority)
  const out = {}
  for (const [key, value] of Object.entries(rewritten)) {
    if (value === undefined || skip.has(key.toLowerCase())) continue
    out[key] = value
  }
  return out
}

export function createPublicProxyServer() {
  const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0]
    if (isProxyHealthPath(urlPath)) {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
      return
    }
    const p = http.request({
      hostname: targetHost,
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: forwardHeaders(req.headers),
    }, (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers)
      upstream.pipe(res)
    })
    p.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
      res.end('upstream unavailable')
    })
    req.pipe(p)
  })

  server.on('upgrade', (req, socket, head) => {
    const headers = rewriteProxyHeaders(req.headers, targetAuthority)
    const proxy = net.connect(targetPort, targetHost, () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`]
      for (const [key, value] of Object.entries(headers)) {
        if (value === undefined) continue
        const rendered = Array.isArray(value) ? value.join(', ') : String(value)
        lines.push(`${key}: ${rendered}`)
      }
      lines.push('', '')
      proxy.write(lines.join('\r\n'))
      if (head.length > 0) proxy.write(head)
      proxy.pipe(socket)
      socket.pipe(proxy)
    })
    proxy.on('error', () => {
      socket.destroy()
    })
    socket.on('error', () => {
      proxy.destroy()
    })
  })

  return server
}

function main() {
  const server = createPublicProxyServer()
  server.listen(listenPort, listenHost, () => {
    console.log(`public proxy ${listenHost}:${listenPort} -> ${targetAuthority}`)
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
