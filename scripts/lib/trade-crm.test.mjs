import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  capturePublicEmail,
  draftOutreach,
  exportLeadsCsv,
  listLeads,
  pipelineSummary,
  quoteCatalog,
  recordReply,
  searchQueries,
  sendOutreach,
  upsertDeal,
  upsertLead,
} from './trade-crm.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '../..')

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'codeseek-crm-'))
  mkdirSync(join(root, 'team/crm'), { recursive: true })
  mkdirSync(join(root, 'store/data'), { recursive: true })
  mkdirSync(join(root, 'team/templates'), { recursive: true })
  cpSync(join(repo, 'store/data/catalog.json'), join(root, 'store/data/catalog.json'))
  writeFileSync(join(root, 'team/crm/leads.json'), `${JSON.stringify({ leads: [] }, null, 2)}\n`)
  writeFileSync(join(root, 'team/crm/deals.json'), `${JSON.stringify({ deals: [] }, null, 2)}\n`)
  return root
}

test('upsert_lead then quote and outreach stay draft-only', () => {
  const root = fixtureRoot()
  try {
    const lead = upsertLead({
      company: 'Kitchenlab AB',
      market: 'SE',
      group: 'hot',
      source: 'KitchenLab about page',
      sourceUrl: 'https://www.kitchenlab.se/om-oss/',
      sku: 'HK-TB-500-SS',
      next: 'draft outreach',
    }, root)
    assert.match(lead.id, /^L-20\d{2}-\d{3}$/)
    assert.equal(lead.touch, 'none')
    const listed = listLeads({ market: 'SE' }, root)
    assert.equal(listed.length, 1)
    const quote = quoteCatalog({ sku: 'HK-TB-500-SS', qty: 200, buyer: lead.company }, root)
    assert.equal(quote.belowMoq, false)
    assert.equal(quote.unitUsd, 12.8)
    assert.match(quote.markdown, /HK-TB-500-SS/)
    assert.match(quote.markdown, /draft quotation/i)
    const letter = draftOutreach({ leadId: lead.id, sku: 'HK-TB-500-SS' }, root)
    assert.match(letter.letter, /Kitchenlab AB/)
    assert.match(letter.letter, /send_outreach/)
    assert.doesNotMatch(letter.letter, /@kitchenlab/)
    const deal = upsertDeal({
      buyer: lead.company,
      sku: 'HK-TB-500-SS',
      qty: 200,
      status: 'quoted',
      leadId: lead.id,
    }, root)
    assert.match(deal.id, /^HK-20\d{2}-\d{3}$/)
    const dealFile = readFileSync(join(root, 'team/deals', `${deal.id}.md`), 'utf8')
    assert.match(dealFile, /HK-TB-500-SS/)
    assert.match(dealFile, /200/)
    const summary = pipelineSummary(root)
    assert.equal(summary.leads, 1)
    assert.equal(summary.deals, 1)
    assert.equal(summary.byGroup.hot, 1)
    assert.equal(summary.byStatus.quoted, 1)
    const md = readFileSync(join(root, 'team/crm/leads.md'), 'utf8')
    assert.match(md, /Kitchenlab AB/)
    assert.match(md, /kitchenlab\.se/)
    const csv = exportLeadsCsv(root)
    assert.match(csv, /^id,company,market/)
    assert.match(csv, /Kitchenlab AB/)
    const queries = searchQueries({ product: 'HK-TB-500-SS', market: 'Nordics' }, root)
    assert.ok(queries.queries.length >= 4)
    assert.match(queries.note, /海关/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('quote_catalog flags qty below MOQ and unknown SKU', () => {
  const root = fixtureRoot()
  try {
    const quote = quoteCatalog({ sku: 'HK-MG-350-CE', qty: 10 }, root)
    assert.equal(quote.belowMoq, true)
    assert.match(quote.markdown, /below MOQ/)
    assert.throws(() => quoteCatalog({ sku: 'NOPE', qty: 1 }, root), /unknown SKU/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('quote_catalog resolves tumbler hints to HK-TB-500-SS', () => {
  const root = fixtureRoot()
  try {
    const quote = quoteCatalog({ sku: '500ml insulated tumbler', qty: 200, buyer: 'Kitchenlab AB' }, root)
    assert.equal(quote.sku, 'HK-TB-500-SS')
    assert.equal(quote.qty, 200)
    assert.equal(quote.unitUsd, 12.8)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('record_reply marks the named buyer and writes their quotation file', () => {
  const root = fixtureRoot()
  try {
    upsertLead({
      company: 'Kitchenlab AB',
      market: 'SE',
      sourceUrl: 'https://www.kitchenlab.se/om-oss/',
      sku: 'HK-TB-500-SS',
    }, root)
    const out = recordReply({
      company: 'Kitchenlab AB',
      sku: 'HK-TB-500-SS',
      qty: 200,
      touch: 'replied',
    }, root)
    assert.equal(out.lead.touch, 'replied')
    assert.equal(out.deal.qty, 200)
    assert.equal(out.deal.sku, 'HK-TB-500-SS')
    assert.equal(out.quote.unitUsd, 12.8)
    const body = readFileSync(join(root, 'team', out.deal.file), 'utf8')
    assert.match(body, /Kitchenlab AB/)
    assert.match(body, /2560\.00/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('upsert_lead ignores invented emails; capture requires the address on the page', async () => {
  const root = fixtureRoot()
  try {
    const lead = upsertLead({
      company: 'Thermobecher.shop',
      market: 'DE',
      sourceUrl: 'https://www.thermobecher.shop/',
      email: 'invented@not-real.example',
      sku: 'HK-TB-500-SS',
    }, root)
    assert.equal(lead.email, '')
    await assert.rejects(
      () => capturePublicEmail({
        leadId: lead.id,
        sourceUrl: 'https://www.thermobecher.shop/impressum',
        fetchImpl: async () => ({ ok: true, text: async () => '<p>no mail here</p>' }),
      }, root),
      /do not invent/,
    )
    const captured = await capturePublicEmail({
      leadId: lead.id,
      sourceUrl: 'https://www.thermobecher.shop/impressum',
      fetchImpl: async () => ({
        ok: true,
        text: async () => '<p>Impressum info@thermobecher.shop</p>',
      }),
    }, root)
    assert.equal(captured.email, 'info@thermobecher.shop')
    assert.match(captured.emailSourceUrl, /impressum/)
    const blocked = await sendOutreach({ leadId: lead.id, env: {} }, root)
    assert.equal(blocked.sent, false)
    assert.equal(blocked.reason, 'mail_not_configured')
    const sent = await sendOutreach({
      leadId: lead.id,
      env: { MAIL_FROM: 'sales@harborkiln.example', RESEND_API_KEY: 're_test' },
      send: async (mail) => {
        assert.equal(mail.to, 'info@thermobecher.shop')
        assert.equal(mail.from, 'sales@harborkiln.example')
        assert.match(mail.subject, /Harbor Kiln/)
        assert.doesNotMatch(mail.text, /INTERNAL/)
        return { transport: 'mock' }
      },
    }, root)
    assert.equal(sent.sent, true)
    assert.equal(listLeads({ q: lead.id }, root)[0].touch, 'user-sent')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
