import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

function clock(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function Avatar({ member, size = 40 }) {
  return (
    <span
      className={`wx-avatar tone-${member?.tone || 'navy'}`}
      style={{ width: size, height: size, fontSize: size > 36 ? 15 : 13 }}
      aria-hidden="true"
    >
      {member?.initials || '?'}
    </span>
  )
}

export default function TeamDesk({ lang, onBack, onToggleLang }) {
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
    return <p className="wx-loading" role="status">{lang === 'zh' ? '正在进入微信工位…' : 'Opening WeChat-style desk…'}</p>
  }

  return (
    <section className="wx" aria-label={lang === 'zh' ? '外贸专家团队' : 'Trade desk'}>
      <aside className="wx-rail" aria-label={lang === 'zh' ? '会话列表' : 'Conversations'}>
        <div className="wx-rail-head">
          <button type="button" className="wx-back" onClick={onBack}>{lang === 'zh' ? '返回' : 'Back'}</button>
          <strong>{lang === 'zh' ? '微信' : 'WeChat'}</strong>
          <button type="button" className="wx-lang" onClick={onToggleLang}>{lang === 'en' ? '中文' : 'EN'}</button>
        </div>
        <div className="wx-search" aria-hidden="true">{lang === 'zh' ? '搜索' : 'Search'}</div>
        <ul className="wx-list">
          {desk.threads.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`wx-row ${row.id === active ? 'on' : ''}`}
                onClick={() => openThread(row.id)}
              >
                <span className="wx-avatar-wrap">
                  <Avatar member={row} />
                  {row.unread > 0 && <span className="wx-badge">{row.unread > 99 ? '99+' : row.unread}</span>}
                </span>
                <span className="wx-row-copy">
                  <span className="wx-row-top">
                    <b>{row.name}</b>
                    <time>{clock(row.lastAt)}</time>
                  </span>
                  <em>{row.lastPreview || row.title}</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="wx-main">
        <header className="wx-chat-head">
          <h2>{current?.kind === 'group' ? (current?.name || '外贸开发总群') : current?.name}</h2>
          <p>{current?.kind === 'group'
            ? (lang === 'zh' ? '群聊 · @队员派工，进度回总群' : 'Group · @ a teammate to assign')
            : `${current?.title}`}</p>
        </header>

        <div className="wx-log" ref={logRef} role="log" aria-live="polite">
          {(desk.messages || []).map((row) => (
            <article key={row.id} className={`wx-msg kind-${row.kind}`}>
              {row.kind !== 'you' && <Avatar member={desk.threads.find((t) => t.id === row.fromId) || { initials: row.fromName?.slice(0, 1), tone: 'navy' }} />}
              <div className="wx-col">
                {row.kind !== 'you' && <span className="wx-who">{row.fromName}</span>}
                <div className="wx-bubble"><pre>{row.text}</pre></div>
                <time>{clock(row.at)}</time>
              </div>
              {row.kind === 'you' && <Avatar member={{ initials: lang === 'zh' ? '我' : 'Me', tone: 'green' }} />}
            </article>
          ))}
        </div>

        {current?.kind === 'group' && (
          <div className="wx-mentions" aria-label="@">
            {desk.threads.filter((row) => row.kind === 'dm' && row.id !== 'lead').map((row) => (
              <button key={row.id} type="button" className="wx-chip" onClick={() => mention(row.handle)}>
                {row.handle}
              </button>
            ))}
          </div>
        )}

        {error && <p className="wx-warn" role="alert">{error}</p>}

        <form className="wx-composer" onSubmit={(e) => { e.preventDefault(); send() }}>
          <label className="skip" htmlFor="wx-input">{lang === 'zh' ? '消息' : 'Message'}</label>
          <textarea
            id="wx-input"
            rows={2}
            value={draft}
            placeholder={current?.kind === 'group'
              ? (lang === 'zh' ? '@营销专家 找北欧买家…' : '@营销专家 find Nordic buyers…')
              : (lang === 'zh' ? `发消息给 ${current?.name}` : `Message ${current?.name}`)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button className="wx-send" type="submit" disabled={busy || !draft.trim()}>
            {lang === 'zh' ? '发送' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  )
}
