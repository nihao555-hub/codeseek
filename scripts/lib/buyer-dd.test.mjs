import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseOpenCorporates,
  parseOpenSanctions,
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
