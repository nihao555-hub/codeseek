/**
 * 港窑外贸工位：总群 + 队员私聊。@花名 派工后，团员往总群汇报并在自己的对话里留下详细稿。
 * 演示调度走 catalog，不调用真实模型、不发真实邮件。
 */
import { canonicalRosterLabel } from '../../scripts/lib/grs-tool-protocol.mjs'
import { allProducts, quoteItems } from './catalog.mjs'

export const TEAM_MEMBERS = [
  {
    id: 'group',
    kind: 'group',
    name: '外贸开发总群',
    title: '港窑全员',
    handle: '@群',
    initials: '群',
    tone: 'gold',
  },
  {
    id: 'lead',
    kind: 'dm',
    name: '管家',
    title: 'Trade Lead',
    handle: '@管家',
    initials: '管',
    tone: 'navy',
    skill: 'foreign-trade',
  },
  {
    id: 'marketing',
    kind: 'dm',
    name: '营销专家',
    title: '挖客 / 开发信',
    handle: '@营销专家',
    initials: '营',
    tone: 'ember',
    skill: 'trade-marketing',
  },
  {
    id: 'ops',
    kind: 'dm',
    name: '运营专家',
    title: '线索 / 跟单',
    handle: '@运营专家',
    initials: '运',
    tone: 'navy',
    skill: 'trade-ops',
  },
  {
    id: 'site',
    kind: 'dm',
    name: '建站专家',
    title: '独立站 / SEO',
    handle: '@建站专家',
    initials: '站',
    tone: 'gold',
    skill: 'ecommerce-store',
  },
  {
    id: 'social',
    kind: 'dm',
    name: '社媒专家',
    title: '内容 / 私信稿',
    handle: '@社媒专家',
    initials: '媒',
    tone: 'ember',
    skill: 'trade-social',
  },
  {
    id: 'inquiry',
    kind: 'dm',
    name: '询盘专员',
    title: 'Inbound 回复',
    handle: '@询盘专员',
    initials: '询',
    tone: 'navy',
    skill: 'trade-inquiry',
  },
  {
    id: 'quote',
    kind: 'dm',
    name: '报价专员',
    title: 'FOB / MOQ',
    handle: '@报价专员',
    initials: '报',
    tone: 'gold',
    skill: 'trade-quote',
  },
  {
    id: 'compliance',
    kind: 'dm',
    name: '合规专员',
    title: '认证 / 出口',
    handle: '@合规专员',
    initials: '合',
    tone: 'navy',
    skill: 'trade-compliance',
  },
  {
    id: 'dd',
    kind: 'dm',
    name: '背调专员',
    title: '公开源尽调',
    handle: '@背调专员',
    initials: '调',
    tone: 'gold',
    skill: 'trade-dd',
  },
  {
    id: 'ads',
    kind: 'dm',
    name: '广告专员',
    title: 'Meta Ads',
    handle: '@广告专员',
    initials: '广',
    tone: 'ember',
    skill: 'meta-ads',
  },
]

const LABEL_TO_ID = Object.fromEntries(
  TEAM_MEMBERS.filter((row) => row.kind === 'dm').map((row) => [row.name, row.id]),
)

export function parseMentions(text) {
  const ids = new Set()
  for (const match of String(text || '').matchAll(/@([^\s@，,。！!？?]+)/g)) {
    const label = canonicalRosterLabel(match[1])
    const id = LABEL_TO_ID[label]
    if (id && id !== 'lead') ids.add(id)
  }
  return [...ids]
}

export function suggestAssignee(text) {
  const source = String(text || '')
  if (/背调|尽调|OFAC|空壳|工商|制裁|opencorporates/i.test(source)) return 'dd'
  if (/开发信|挖客|进口商|cold\s*mail|outreach|linkedin/i.test(source)) return 'marketing'
  if (/报价|MOQ|FOB|PI\b|单价/i.test(source)) return 'quote'
  if (/询盘|回复邮件|whatsapp inbound/i.test(source)) return 'inquiry'
  if (/认证|FDA|LFGB|\bCE\b|合规/i.test(source)) return 'compliance'
  if (/独立站|SEO|店面|建站/i.test(source)) return 'site'
  if (/社媒|帖子|Instagram|内容日历/i.test(source)) return 'social'
  if (/样品|船期|跟单|订金|质检/i.test(source)) return 'ops'
  if (/广告|Meta|Facebook|投放/i.test(source)) return 'ads'
  return ''
}

function pickProduct(text) {
  const hay = String(text || '').toUpperCase()
  const products = allProducts()
  return products.find((p) => hay.includes(p.sku) || hay.includes(p.id.toUpperCase())) || products[0]
}

function memberById(id) {
  return TEAM_MEMBERS.find((row) => row.id === id)
}

function draftFor(memberId, text) {
  const product = pickProduct(text)
  const member = memberById(memberId)
  if (memberId === 'marketing') {
    return [
      `Subject: ${product.sku} for Nordic / EU housewares buyers — Harbor Kiln`,
      '',
      'Hi team,',
      `I saw you import drinkware. Harbor Kiln supplies ${product.name.en} (${product.sku}) ${product.incoterm}.`,
      `Spec: ${product.specs.en[0]}; certs on file: ${product.certs.join(', ')}. MOQ ${product.moq}.`,
      'If useful I can send a sample pack and a 14-day USD quote. This is a draft — not sent.',
    ].join('\n')
  }
  if (memberId === 'quote') {
    const quoted = quoteItems([{ productId: product.id, qty: product.moq }])
    return [
      `${product.sku} ${product.name.zh}`,
      `USD ${product.priceUsd} · ${product.incoterm} · MOQ ${product.moq} · ${product.leadDays} 天`,
      `按 MOQ 试算小计 $${quoted.subtotal}，出口操作费 $${quoted.shippingUsd}，合计 $${quoted.totalUsd}。`,
      quoted.lines[0]?.belowMoq ? '低于 MOQ，工厂可能重报。' : '数量达到 MOQ。',
      '客户稿不含底价。有效期 14 天。',
    ].join('\n')
  }
  if (memberId === 'inquiry') {
    return [
      `Hi, thanks for asking about ${product.name.en}.`,
      `We can supply ${product.sku} ${product.incoterm}, MOQ ${product.moq}, lead time ${product.leadDays} days.`,
      `Papers on this SKU: ${product.certs.join(', ')}. Next step: sample or a 15-minute call.`,
    ].join('\n')
  }
  if (memberId === 'compliance') {
    return `${product.sku} 目录认证：${product.certs.join(' / ') || '无'}。没有的证书写 TBD, factory confirm，不编。`
  }
  if (memberId === 'dd') {
    return [
      `公开源背调草稿（不是海关提单）· 对照 ${product.sku}`,
      '1. mcp__buyer-dd__company_search 查公司英文名 / 本地名',
      '2. mcp__buyer-dd__sanctions_search 查 OFAC / EU / UN 名单；命中只写 possible match',
      '3. web_search + web_fetch 官网 / 登记机关 / 展会名录',
      '4. 模板 team/templates/due-diligence.md；未知写 TBD',
      '没有提单、货值、供应商列表。不要编。',
    ].join('\n')
  }
  if (memberId === 'ops') {
    return '看板 HK-2026-001 Nordic Home Co. 现为 quoted，下一步等镭雕与样品地址（2026-08-22）。线索池见 team/crm/leads.md。'
  }
  if (memberId === 'site') {
    return '独立站在本仓库 store/。店面入口 /#/shop，工位页 /#/team。询盘表单不发真实邮件。'
  }
  if (memberId === 'social') {
    return [
      'LinkedIn 草稿：Harbor Kiln ships factory drinkware FOB Shenzhen / Ningbo. MOQ and papers stay on the SKU card — no invented CE.',
      'CTA: 看独立站目录或回询盘。未发帖。',
    ].join('\n')
  }
  if (memberId === 'ads') {
    return 'Meta 广告走官方 Ads MCP。没有 META_ACCESS_TOKEN 时先说缺口。新广告默认 PAUSED。'
  }
  return `${member?.name || memberId} 已记下：${text}`
}

export function createTeamDesk({ now = () => new Date().toISOString() } = {}) {
  let seq = 0
  const messages = []
  const unread = Object.fromEntries(TEAM_MEMBERS.map((row) => [row.id, 0]))

  function push(threadId, fromId, text, { bumpUnread = true } = {}) {
    seq += 1
    const from = memberById(fromId) || memberById('lead')
    const row = {
      id: `m-${seq}`,
      threadId,
      fromId,
      fromName: fromId === 'you' ? '你' : from.name,
      kind: fromId === 'you' ? 'you' : fromId === 'lead' ? 'lead' : 'member',
      text,
      at: now(),
    }
    messages.push(row)
    if (bumpUnread && threadId !== 'group') unread[threadId] += 1
    if (bumpUnread && threadId === 'group' && fromId !== 'you') unread.group += 1
    return row
  }

  function lastOf(threadId) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].threadId === threadId) return messages[i]
    }
    return null
  }

  function snapshot(activeId = 'group') {
    return {
      members: TEAM_MEMBERS,
      threads: TEAM_MEMBERS.map((row) => {
        const last = lastOf(row.id)
        return {
          ...row,
          unread: row.id === activeId ? 0 : unread[row.id] || 0,
          lastPreview: last?.text?.replace(/\s+/g, ' ').slice(0, 72) || '',
          lastAt: last?.at || '',
        }
      }),
      messages: messages.filter((row) => row.threadId === activeId),
      activeId,
    }
  }

  function dispatch(memberId, task) {
    const member = memberById(memberId)
    const draft = draftFor(memberId, task)
    push('group', 'lead', `已 ${member.handle} 去处理，进度会打在总群，详细稿在 ${member.name} 的工位。`, { bumpUnread: false })
    push('group', memberId, `【${member.name}】已接到：${task.replace(/\s+/g, ' ').slice(0, 80)}`)
    push('group', memberId, `【${member.name}】进行中：正在按 catalog 出稿，不发真实邮件。`)
    push(memberId, memberId, draft, { bumpUnread: true })
    push('group', memberId, `【${member.name}】完成：详细稿已私发到我的工位。可粘贴，状态 draft。`)
  }

  push('group', 'lead', '外贸开发总群已开。左侧点队员头像进工位，或在总群 @营销专家 指派。短问题我可以直接查目录。', { bumpUnread: false })

  return {
    snapshot,
    post({ threadId = 'group', text = '' } = {}) {
      const body = String(text || '').trim()
      if (!body) return { error: 'empty', status: 400 }
      const thread = memberById(threadId) || memberById('group')
      const target = thread.kind === 'group' ? 'group' : thread.id
      push(target, 'you', body, { bumpUnread: false })
      unread[target] = 0

      if (target !== 'group') {
        const draft = draftFor(target, body)
        const member = memberById(target)
        push(target, target, `【${member.name}】已接到（私聊）。`)
        push(target, target, draft)
        push('group', target, `【${member.name}】完成：私聊任务已回，稿在我的工位。`)
        return snapshot(target)
      }

      const mentioned = parseMentions(body)
      const auto = mentioned.length ? mentioned : (suggestAssignee(body) ? [suggestAssignee(body)] : [])
      if (auto.length === 0) {
        const product = pickProduct(body)
        push('group', 'lead', `${product.sku} 目录价 USD ${product.priceUsd}，${product.incoterm}，MOQ ${product.moq}。要挖客请 @营销专家，要报价请 @报价专员。`, { bumpUnread: false })
        return snapshot('group')
      }
      for (const id of auto) dispatch(id, body)
      return snapshot('group')
    },
    markRead(threadId) {
      if (unread[threadId] != null) unread[threadId] = 0
      return snapshot(threadId)
    },
  }
}
