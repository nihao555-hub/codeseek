import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractPublicEmails, mailConfig, sameSite } from './trade-mail.mjs'

test('extractPublicEmails keeps impressum addresses on the same site', () => {
  const html = '<p>Kontakt: <a href="mailto:info@thermobecher.shop">info@thermobecher.shop</a></p>'
  const found = extractPublicEmails(html, 'https://www.thermobecher.shop/impressum', 'https://www.thermobecher.shop/')
  assert.equal(found[0].email, 'info@thermobecher.shop')
})

test('extractPublicEmails keeps mailto addresses published on the same site', () => {
  const html = '<a href="mailto:sales@foxx-merch.gmbh">sales</a>'
  const found = extractPublicEmails(
    html,
    'https://www.werbeartikel-grosshandel.de/',
    'https://www.werbeartikel-grosshandel.de/de/thermobecher-500-ml',
  )
  assert.equal(found[0].email, 'sales@foxx-merch.gmbh')
})

test('extractPublicEmails drops other-domain and junk addresses', () => {
  const html = 'mail sentry@sentry.io and sales@other-company.com and logo@cdn.example.png'
  const found = extractPublicEmails(
    html,
    'https://frank-werbeartikel.de/impressum/',
    'https://frank-werbeartikel.de/produkt/x',
  )
  assert.equal(found.length, 0)
})

test('sameSite treats www and apex as one company', () => {
  assert.equal(sameSite('https://www.thermobecher.shop/impressum', 'https://thermobecher.shop/'), true)
  assert.equal(sameSite('https://evil.example/impressum', 'https://thermobecher.shop/'), false)
})

test('mailConfig requires Harbor Kiln from-address plus a transport', () => {
  assert.equal(mailConfig({}).ready, false)
  assert.ok(mailConfig({}).missing.includes('MAIL_FROM'))
  const resend = mailConfig({ MAIL_FROM: 'sales@harborkiln.example', RESEND_API_KEY: 're_test' })
  assert.equal(resend.ready, true)
  assert.equal(resend.kind, 'resend')
  const smtp = mailConfig({
    MAIL_FROM: 'sales@harborkiln.example',
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'sales@harborkiln.example',
    SMTP_PASS: 'secret',
  })
  assert.equal(smtp.ready, true)
  assert.equal(smtp.kind, 'smtp')
})
