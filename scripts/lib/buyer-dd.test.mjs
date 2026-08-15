import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseOpenCorporates,
  parseOpenSanctions,
  parseOpenSanctionsHtml,
  parseGleif,
  formatCompanyHits,
  formatSanctionsHits,
  searchCompanies,
  searchSanctions,
} from './buyer-dd.mjs'

test('parseOpenCorporates maps registry hits', () => {
  const rows = parseOpenCorporates({
    results: {
      companies: [{
        company: {
          name: 'NORDIC HOME CO AB',
          company_number: '556677-8899',
          jurisdiction_code: 'se',
          current_status: 'Active',
          registered_address_in_full: 'Stockholm',
          opencorporates_url: 'https://opencorporates.com/companies/se/556677-8899',
        },
      }],
    },
  })
  assert.equal(rows[0].name, 'NORDIC HOME CO AB')
  assert.match(formatCompanyHits('Nordic Home', rows), /556677-8899/)
  assert.match(formatCompanyHits('Nordic Home', []), /not a customs database/i)
})

test('parseOpenSanctions marks possible matches', () => {
  const rows = parseOpenSanctions({
    results: [{
      id: 'ofac-123',
      caption: 'Example Shipping Ltd',
      schema: 'Company',
      datasets: ['us_ofac_sdn'],
      score: 0.9,
    }],
  })
  assert.equal(rows[0].caption, 'Example Shipping Ltd')
  const text = formatSanctionsHits('Example Shipping', rows)
  assert.match(text, /POSSIBLE MATCH/)
  assert.match(text, /opensanctions.org/)
})

test('search helpers use mocked fetch', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('opencorporates')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ results: { companies: [] } }),
      }
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [] }),
    }
  }
  const companies = await searchCompanies('Nordic Home Co', { fetchImpl })
  assert.match(companies.text, /no company hit/)
  const sanctions = await searchSanctions('Nordic Home Co', { fetchImpl })
  assert.match(sanctions.text, /no list hit/)
})

test('parseGleif maps LEI records', () => {
  const rows = parseGleif({
    data: [{
      id: '213800VSV3U2XR64PV69',
      attributes: {
        lei: '213800VSV3U2XR64PV69',
        entity: {
          legalName: { name: 'IKEA Centres Sverige AB' },
          jurisdiction: 'SE',
          legalAddress: { addressLines: ['Stockholm'], country: 'SE' },
        },
        registration: { status: 'ISSUED' },
      },
    }],
  })
  assert.equal(rows[0].name, 'IKEA Centres Sverige AB')
  assert.match(rows[0].url, /gleif/)
})

test('parseOpenSanctionsHtml reads Next search cards', () => {
  const html = '{"href":"/entities/us-medla-abc/","rel":"nofollow","children":"Ikea Brown"}'
  const rows = parseOpenSanctionsHtml(html)
  assert.equal(rows[0].caption, 'Ikea Brown')
  assert.match(rows[0].url, /opensanctions.org\/entities\/us-medla-abc/)
})

test('parseOpenSanctionsHtml unescapes RSC quoted JSON', () => {
  const html = 'href=\\"/entities/us-medla-xyz/\\",\\"rel\\":\\"nofollow\\",\\"children\\":\\"Ikea Brown\\"'
  const rows = parseOpenSanctionsHtml(html)
  assert.equal(rows[0].id, 'us-medla-xyz')
  assert.equal(rows[0].caption, 'Ikea Brown')
})

test('searchCompanies falls back to GLEIF when OpenCorporates 401s', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('opencorporates')) {
      return { ok: false, status: 401, text: async () => 'nope' }
    }
    if (String(url).includes('gleif')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          data: [{
            attributes: {
              lei: '123',
              entity: { legalName: { name: 'Demo AB' }, legalAddress: { country: 'SE' } },
            },
          }],
        }),
      }
    }
    throw new Error(`unexpected ${url}`)
  }
  const out = await searchCompanies('Demo AB', { fetchImpl })
  assert.equal(out.source, 'gleif')
  assert.match(out.text, /Demo AB/)
})

test('searchSanctions falls back to HTML when API 401s', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('api.opensanctions')) {
      return { ok: false, status: 401, text: async () => 'nope' }
    }
    return {
      ok: true,
      status: 200,
      text: async () => '{"href":"/entities/abc-1/","rel":"nofollow","children":"Possible Co"}',
    }
  }
  const out = await searchSanctions('Possible Co', { fetchImpl })
  assert.equal(out.source, 'opensanctions-html')
  assert.match(out.text, /Possible Co/)
  assert.match(out.text, /POSSIBLE MATCH/)
})
