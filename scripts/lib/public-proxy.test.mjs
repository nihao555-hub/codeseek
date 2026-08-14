import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isProxyHealthPath, loopbackAuthority, rewriteProxyHeaders } from './public-proxy.mjs'

test('rewrites Host and Origin onto the loopback webserver', () => {
  const headers = rewriteProxyHeaders({
    host: 'abc.trycloudflare.com',
    origin: 'https://abc.trycloudflare.com',
    referer: 'https://abc.trycloudflare.com/chat?x=1',
    'content-type': 'application/json',
  }, loopbackAuthority('127.0.0.1', 3080))
  assert.equal(headers.host, '127.0.0.1:3080')
  assert.equal(headers.origin, 'https://127.0.0.1:3080')
  assert.equal(headers.referer, 'http://127.0.0.1:3080/chat?x=1')
  assert.equal(headers['content-type'], 'application/json')
})

test('leaves missing Origin alone so unmarked requests still pass the fence', () => {
  const headers = rewriteProxyHeaders({ host: '10.0.0.8:3081' }, '127.0.0.1:3080')
  assert.equal(headers.host, '127.0.0.1:3080')
  assert.equal(headers.origin, undefined)
})

test('proxy health path is local', () => {
  assert.equal(isProxyHealthPath('/__proxy_health'), true)
  assert.equal(isProxyHealthPath('/'), false)
})
