/**
 * 港窑实时活动面板：Web 右侧栏。
 * 官方已有 details 列（点开工具才出现）和对话里的 workflow-run。
 * 本插件把「正在做什么」常驻右侧，数据来自会话 runningCalls + team/crm。
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
