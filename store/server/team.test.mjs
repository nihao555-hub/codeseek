import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTeamDesk, parseMentions, suggestAssignee } from './team.mjs'
import { createHarborServer } from './index.mjs'

test('parseMentions and suggestAssignee map roster handles', () => {
  assert.deepEqual(parseMentions('@营销专家 找客'), ['marketing'])
  assert.deepEqual(parseMentions('@营销 和 @报价专员'), ['marketing', 'quote'])
  assert.equal(suggestAssignee('写一封开发信'), 'marketing')
  assert.equal(suggestAssignee('HK-TB-500-SS 的 FDA'), 'compliance')
})

test('group @mention posts reports in the group and a private draft', () => {
  const desk = createTeamDesk({ now: () => '2026-08-15T00:00:00.000Z' })
  const out = desk.post({ threadId: 'group', text: '@营销专家 找北欧买家买 HK-TB-500-SS' })
  assert.equal(out.activeId, 'group')
  const texts = out.messages.map((row) => row.text).join('\n')
  assert.match(texts, /已 @营销专家/)
  assert.match(texts, /【营销专家】已接到/)
  assert.match(texts, /【营销专家】完成/)
  const dm = desk.snapshot('marketing')
  assert.match(dm.messages.map((row) => row.text).join('\n'), /HK-TB-500-SS/)
  assert.match(dm.messages.map((row) => row.text).join('\n'), /not sent|draft|Harbor Kiln/i)
})

test('direct seat chat reports back to the group', () => {
  const desk = createTeamDesk({ now: () => '2026-08-15T00:00:00.000Z' })
  const dm = desk.post({ threadId: 'quote', text: 'HK-MG-350-CE 300 pcs' })
  assert.equal(dm.activeId, 'quote')
  assert.match(dm.messages.at(-1).text, /HK-MG-350-CE|FOB Ningbo|MOQ/)
  const group = desk.snapshot('group')
  assert.match(group.messages.at(-1).text, /【报价专员】完成/)
})

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

test('team HTTP desk round-trip', async (t) => {
  const server = createHarborServer()
  const url = await listen(server)
  t.after(() => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))))

  const boot = await fetch(`${url}/api/team`)
  const desk = await boot.json()
  assert.equal(boot.status, 200)
  assert.equal(desk.threads[0].id, 'group')
  assert.ok(desk.threads.some((row) => row.id === 'marketing'))

  const sent = await fetch(`${url}/api/team/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ threadId: 'group', text: '@报价专员 HK-TB-500-SS MOQ' }),
  })
  const body = await sent.json()
  assert.equal(sent.status, 201)
  assert.match(body.messages.map((row) => row.text).join('\n'), /【报价专员】完成/)

  const empty = await fetch(`${url}/api/team/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ threadId: 'group', text: '   ' }),
  })
  assert.equal(empty.status, 400)

  const seat = await fetch(`${url}/api/team?thread=quote`)
  const seatBody = await seat.json()
  assert.equal(seat.status, 200)
  assert.equal(seatBody.activeId, 'quote')
  assert.match(seatBody.messages.map((row) => row.text).join('\n'), /HK-TB-500-SS/)
})
