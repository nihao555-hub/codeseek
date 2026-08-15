/**
 * 港窑实时：会话顶栏 conversation.view（和 Chat / Trajectory 并列）。
 * 官方 details 列要点开工具才出现；本插件把「正在做什么」做成一页。
 * 宿主听 session/event，浏览器每 2 秒拉 CRM + 在飞工具。
 */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { realpathSync } from 'node:fs'

const srcDir = dirname(realpathSync(fileURLToPath(import.meta.url)))
const { activitySnapshot } = await import(
  pathToFileURL(join(srcDir, '../../../scripts/lib/trade-activity.mjs')).href
)

export { activitySnapshot }
export const name = 'codeseek-activity-panel'
export const inject = ['webServer']

function clip(text, n) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  return value.length > n ? `${value.slice(0, n)}…` : value
}

const inflight = new Map()
const recent = []
const members = new Map()
let liveRunning = false
let liveSessionId = null

export function resetLiveActivity() {
  inflight.clear()
  recent.length = 0
  members.clear()
  liveRunning = false
  liveSessionId = null
}

export function ingestLiveEvent(session, event) {
  if (!event || !event.type) return
  if (session && session.id) liveSessionId = session.id
  const data = event.data || {}
  if (event.type === 'turn/start' || event.type === 'user/message') liveRunning = true
  if (event.type === 'turn/end') liveRunning = false
  if (event.type === 'tool/call') {
    liveRunning = true
    const id = String(data.callId || event.seq || `${data.name}-${Date.now()}`)
    const row = { id, name: data.name || 'tool', args: clip(data.arguments, 80) }
    inflight.set(id, row)
    if (String(data.name || '').includes('subagent')) {
      members.set(id, { id, title: clip(data.arguments, 48) || '子代理', running: true })
    }
  }
  if (event.type === 'tool/result') {
    const id = String(
      data.callId
      || data.message?.content?.[0]?.toolCallId
      || '',
    )
    const row = inflight.get(id)
    if (row) {
      inflight.delete(id)
      recent.unshift(row)
      if (recent.length > 8) recent.pop()
    }
    const member = members.get(id)
    if (member) members.set(id, { ...member, running: false })
  }
}

export function liveActivity() {
  const calls = [...inflight.values()]
  return {
    sessionId: liveSessionId,
    running: liveRunning || calls.length > 0,
    calls,
    recent: recent.slice(0, 8),
    members: [...members.values()].slice(-6),
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function snapshot(ctx) {
  const data = activitySnapshot()
  data.live = liveActivity()
  try {
    const schemas = ctx.get('tools')?.schemas?.() || []
    data.liveTools = schemas.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
    }))
  } catch {
    data.liveTools = []
  }
  return data
}

export function apply(ctx) {
  ctx.on('session/event', (session, event) => {
    ingestLiveEvent(session, event)
  }, { global: true })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/__codeseek/activity',
    handler: (req, res) => {
      if (req.method === 'GET') {
        sendJson(res, 200, snapshot(ctx))
        return
      }
      sendJson(res, 405, { error: 'method not allowed' })
    },
  }), 'codeseek-activity-panel: get')
}
