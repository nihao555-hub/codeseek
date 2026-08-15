/**
 * 港窑工具箱面板：Web 设置 → 插件 →「工具与 MCP」。
 * 官方设置只有插件配置卡和 Cordis 清单，没有 MCP 开关；本插件补上。
 *
 * 相对路径按 realpath 解析：Web profile 里这个包是 symlink，
 * import.meta.url 可能落在 node_modules/codeseek-toolkit-panel。
 */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { realpathSync } from 'node:fs'

const srcDir = dirname(realpathSync(fileURLToPath(import.meta.url)))
const { describeToolkit, setMcpEnabled } = await import(
  pathToFileURL(join(srcDir, '../../../scripts/assemble-toolkit.mjs')).href
)

export const name = 'codeseek-toolkit-panel'
export const inject = ['webServer']

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return {}
  return JSON.parse(raw)
}

function snapshot(ctx) {
  const data = describeToolkit()
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
    path: '/__codeseek/toolkit',
    handler: (req, res) => {
      if (req.method === 'GET') {
        sendJson(res, 200, snapshot(ctx))
        return
      }
      sendJson(res, 405, { error: 'method not allowed' })
    },
  }), 'codeseek-toolkit-panel: get')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/__codeseek/toolkit/mcp',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }
      try {
        const body = await readJson(req)
        const id = String(body.id || '').trim()
        if (!id) {
          sendJson(res, 400, { error: 'missing id' })
          return
        }
        const data = setMcpEnabled(id, body.enabled !== false)
        data.restartRequired = true
        sendJson(res, 200, data)
      } catch (error) {
        sendJson(res, 400, { error: String(error.message || error) })
      }
    },
  }), 'codeseek-toolkit-panel: post')

  ctx.inject(['commands'], (scope) => {
    scope.effect(() => scope.commands.register({
      name: 'toolkit',
      description: '列出主机工具、MCP 与 skill。开关请到 设置 → 插件 → 工具与 MCP。',
      handler: () => {
        const data = snapshot(ctx)
        const on = data.mcp.filter((row) => row.enabled).map((row) => row.id)
        const off = data.mcp.filter((row) => !row.enabled).map((row) => row.id)
        const live = (data.liveTools || []).map((row) => row.name)
        return {
          kind: 'success',
          text: [
            '设置 → 插件 → 工具与 MCP 可以开关 MCP。',
            `已开 MCP: ${on.join(', ') || '（无）'}`,
            `未开 MCP: ${off.join(', ') || '（无）'}`,
            live.length ? `当前会话可见工具 ${live.length} 个：${live.slice(0, 40).join(', ')}${live.length > 40 ? '…' : ''}` : '当前没有挂上会话，live 工具列表为空。',
            data.restartHint,
          ].join('\n'),
        }
      },
    }), 'codeseek-toolkit-panel: /toolkit')
  })
}
