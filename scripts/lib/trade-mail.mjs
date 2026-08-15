/**
 * 港窑发信：只把官网页面上出现过的邮箱发出去。
 * 禁止编造收件人。没有 MAIL_FROM + (SMTP 或 Resend) 就拒绝发送。
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const execFileAsync = promisify(execFile)
const EMAIL_RE = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi
const JUNK_EMAIL = /(?:example\.com|sentry\.io|wixpress|cloudflare|schema\.org|png|jpe?g|webp|svg|css|js)$/i
const CONTACT_PATH = /impressum|imprint|kontakt|contact|about|legal|datenschutz/i
const PERSONAL_MAIL = /^(gmail|googlemail|gmx|web|outlook|hotmail|yahoo|icloud|proton)\./i

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

export function sameSite(a, b) {
  const left = hostOf(a) || String(a || '').replace(/^www\./i, '').toLowerCase()
  const right = hostOf(b) || String(b || '').replace(/^www\./i, '').toLowerCase()
  if (!left || !right) return false
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`)
}

export function emailDomain(email) {
  return String(email || '').split('@')[1]?.replace(/^www\./i, '').toLowerCase() || ''
}

function isJunkEmail(email) {
  const value = String(email || '').toLowerCase()
  if (!value.includes('@')) return true
  if (JUNK_EMAIL.test(value)) return true
  if (/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(value)) return true
  return false
}

export function extractPublicEmails(html, pageUrl, siteUrl = pageUrl) {
  if (!sameSite(pageUrl, siteUrl)) return []
  const pageIsContact = CONTACT_PATH.test(String(pageUrl || ''))
  const raw = String(html || '')
  const mailtos = new Set(
    [...raw.matchAll(/mailto:([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/gi)]
      .map((row) => row[1].toLowerCase())
      .filter((email) => !isJunkEmail(email)),
  )
  const found = [...new Set(raw.match(EMAIL_RE) || [])]
    .map((row) => row.toLowerCase())
    .filter((email) => !isJunkEmail(email))
  return found.filter((email) => {
    const domain = emailDomain(email)
    if (sameSite(`https://${domain}`, pageUrl)) return true
    if (pageIsContact && PERSONAL_MAIL.test(domain)) return true
    return mailtos.has(email)
  }).map((email) => ({ email, sourceUrl: pageUrl }))
}

export function mailConfig(env = process.env) {
  const from = String(env.MAIL_FROM || env.SMTP_FROM || '').trim()
  const apiKey = String(env.RESEND_API_KEY || '').trim()
  const host = String(env.SMTP_HOST || '').trim()
  const user = String(env.SMTP_USER || '').trim()
  const pass = String(env.SMTP_PASS || env.SMTP_PASSWORD || '').trim()
  const port = Number(env.SMTP_PORT || (env.SMTP_SECURE === '1' ? 465 : 587))
  const secure = env.SMTP_SECURE === '1' || port === 465
  if (from && apiKey) {
    return { ready: true, kind: 'resend', from, apiKey, missing: [] }
  }
  if (from && host && user && pass) {
    return { ready: true, kind: 'smtp', from, host, port, user, pass, secure, missing: [] }
  }
  const missing = []
  if (!from) missing.push('MAIL_FROM')
  if (!apiKey && !host) missing.push('RESEND_API_KEY 或 SMTP_HOST')
  if (!apiKey) {
    if (host && !user) missing.push('SMTP_USER')
    if (host && !pass) missing.push('SMTP_PASS')
    if (!host && !apiKey && from) missing.push('SMTP_USER')
  }
  return { ready: false, kind: null, from: from || null, missing }
}

export async function fetchPage(url, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(url, {
    headers: { 'user-agent': 'codeseek-harbor-kiln/1.0 (+https://github.com/nihao555-hub/codeseek)' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.text()
}

export async function sendMail(config, { to, subject, text }, fetchImpl = globalThis.fetch) {
  if (!config?.ready) {
    throw new Error(`mail not configured: missing ${config?.missing?.join(', ') || 'MAIL_FROM'}`)
  }
  if (config.kind === 'resend') {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: [to],
        subject,
        text,
      }),
    })
    const body = await res.text()
    if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 300)}`)
    return { transport: 'resend', id: body.slice(0, 200) }
  }
  const env = {
    ...process.env,
    HK_SMTP_HOST: config.host,
    HK_SMTP_PORT: String(config.port),
    HK_SMTP_USER: config.user,
    HK_SMTP_PASS: config.pass,
    HK_SMTP_FROM: config.from,
    HK_SMTP_SECURE: config.secure ? '1' : '0',
    HK_MAIL_TO: to,
    HK_MAIL_SUBJECT: subject,
    HK_MAIL_TEXT: text,
  }
  const py = [
    'import os, smtplib, ssl',
    'from email.message import EmailMessage',
    'msg = EmailMessage()',
    "msg['From'] = os.environ['HK_SMTP_FROM']",
    "msg['To'] = os.environ['HK_MAIL_TO']",
    "msg['Subject'] = os.environ['HK_MAIL_SUBJECT']",
    "msg.set_content(os.environ['HK_MAIL_TEXT'])",
    'host = os.environ["HK_SMTP_HOST"]',
    'port = int(os.environ["HK_SMTP_PORT"])',
    'user = os.environ["HK_SMTP_USER"]',
    'password = os.environ["HK_SMTP_PASS"]',
    'ctx = ssl.create_default_context()',
    'if os.environ.get("HK_SMTP_SECURE") == "1" or port == 465:',
    '    with smtplib.SMTP_SSL(host, port, context=ctx, timeout=30) as smtp:',
    '        smtp.login(user, password)',
    '        smtp.send_message(msg)',
    'else:',
    '    with smtplib.SMTP(host, port, timeout=30) as smtp:',
    '        smtp.ehlo()',
    '        smtp.starttls(context=ctx)',
    '        smtp.login(user, password)',
    '        smtp.send_message(msg)',
    "print('sent')",
  ].join('\n')
  await execFileAsync('python3', ['-c', py], { env, timeout: 45000, maxBuffer: 1_000_000 })
  return { transport: 'smtp', id: `${to}` }
}

export function appendSentLog(root, row) {
  const path = join(root, 'team/deals/local/sent.jsonl')
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `${JSON.stringify(row)}\n`)
  return path
}
