import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

function Avatar({ member }) {
  return (
    <span className={`desk-avatar tone-${member.tone}`} aria-hidden="true">{member.initials}</span>
  )
}

export default function TeamDesk({ lang }) {
  const [desk, setDesk] = useState(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const logRef = useRef(null)
  const active = desk?.activeId || 'group'
  const current = desk?.threads?.find((row) => row.id === active)

  useEffect(() => {
    let cancelled = false
    api.team()
      .then((data) => { if (!cancelled) setDesk(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const node = logRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [desk?.messages, active])

  const openThread = async (id) => {
    setError('')
    try {
      setDesk(await api.team(id))
    } catch (err) {
      setError(err.message)
    }
  }

  const send = async (text) => {
    const body = (text ?? draft).trim()
    if (!body || busy) return
    setBusy(true)
    setError('')
    try {
      setDesk(await api.teamSend({ threadId: active, text: body }))
      setDraft('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const mention = (handle) => {
    setDraft((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${handle} `)
  }

  if (!desk) {
    return <p className="meta" role="status">{lang === 'zh' ? '正在打开工位…' : 'Opening the trade desk…'}</p>
  }

  return (
    <section className="desk" aria-label={lang === 'zh' ? '外贸专家团队' : 'Trade desk'}>
      <aside className="desk-rail" aria-label={lang === 'zh' ? '会话列表' : 'Conversations'}>
        <div className="desk-rail-head">
          <strong>{lang === 'zh' ? '外贸专家团队' : 'Trade desk'}</strong>
          <span>{lang === 'zh' ? '总群 + 队员工位' : 'Group + member seats'}</span>
        </div>
        <ul className="desk-list">
          {desk.threads.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`desk-row ${row.id === active ? 'on' : ''}`}
                onClick={() => openThread(row.id)}
              >
                <Avatar member={row} />
                <span className="desk-row-copy">
                  <b>{row.name}</b>
                  <em>{row.lastPreview || row.title}</em>
                </span>
                {row.unread > 0 && <span className="desk-badge">{row.unread}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="desk-main">
        <header className="desk-chat-head">
          <Avatar member={current || desk.threads[0]} />
          <div>
            <h2>{current?.name}</h2>
            <p>{current?.kind === 'group'
              ? (lang === 'zh' ? '在这里 @花名 指派。团员会汇报到总群，详细稿进工位。' : 'Mention a teammate with @. They report in the group; drafts land in their seat.')
              : `${current?.title} · ${current?.handle}`}</p>
          </div>
        </header>

        <div className="desk-log" ref={logRef} role="log" aria-live="polite">
          {(desk.messages || []).map((row) => (
            <article key={row.id} className={`desk-bubble kind-${row.kind}`}>
              <span className="desk-who">{row.fromName}</span>
              <pre>{row.text}</pre>
            </article>
          ))}
        </div>

        {current?.kind === 'group' && (
          <div className="desk-mentions" aria-label="@">
            {desk.threads.filter((row) => row.kind === 'dm' && row.id !== 'lead').map((row) => (
              <button key={row.id} type="button" className="desk-chip" onClick={() => mention(row.handle)}>
                {row.handle}
              </button>
            ))}
          </div>
        )}

        {error && <p className="warn" role="alert">{error}</p>}

        <form className="desk-composer" onSubmit={(e) => { e.preventDefault(); send() }}>
          <label className="skip" htmlFor="desk-input">{lang === 'zh' ? '消息' : 'Message'}</label>
          <textarea
            id="desk-input"
            rows={3}
            value={draft}
            placeholder={current?.kind === 'group'
              ? (lang === 'zh' ? '@营销专家 找北欧买家…' : '@营销专家 find Nordic buyers…')
              : (lang === 'zh' ? `私聊 ${current?.name}` : `Message ${current?.name}`)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button className="btn" type="submit" disabled={busy || !draft.trim()}>
            {lang === 'zh' ? '发送' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  )
}
