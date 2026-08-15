#!/usr/bin/env node
/**
 * 港窑外贸 CRM MCP：线索、商机、目录报价、开发信草稿。NDJSON，不代发邮件。
 */
import {
  draftOutreach,
  exportLeadsCsv,
  formatDeals,
  formatLeads,
  listDeals,
  listLeads,
  pipelineSummary,
  quoteCatalog,
  recordReply,
  searchQueries,
  upsertDeal,
  upsertLead,
} from './lib/trade-crm.mjs'
import { startStdioMcpServer } from './lib/mcp-stdio.mjs'

const TOOLS = [
  {
    name: 'list_leads',
    description: 'List Harbor Kiln buyer leads (hot/warm/nurture/sleeping/closed). Public-web CRM, not customs data.',
    inputSchema: {
      type: 'object',
      properties: {
        group: { type: 'string', description: 'hot | warm | nurture | sleeping | closed' },
        market: { type: 'string' },
        q: { type: 'string', description: 'search company / id / sku' },
      },
    },
  },
  {
    name: 'upsert_lead',
    description: 'Create or update a lead after a public-web find. Never invent emails. Touch stays draft until the user says they sent it.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        company: { type: 'string' },
        market: { type: 'string' },
        group: { type: 'string' },
        source: { type: 'string' },
        sourceUrl: { type: 'string' },
        touch: { type: 'string' },
        next: { type: 'string' },
        due: { type: 'string' },
        sku: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['company'],
    },
  },
  {
    name: 'list_deals',
    description: 'List inquiry/quote/order pipeline rows (new → shipped).',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        q: { type: 'string' },
      },
    },
  },
  {
    name: 'upsert_deal',
    description: 'Create or update a deal after an inquiry or quote. Writes team/pipeline.md.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        buyer: { type: 'string' },
        sku: { type: 'string' },
        qty: { type: 'number' },
        status: { type: 'string' },
        next: { type: 'string' },
        due: { type: 'string' },
        leadId: { type: 'string' },
        file: { type: 'string' },
      },
      required: ['buyer'],
    },
  },
  {
    name: 'pipeline_summary',
    description: 'Counts leads by group and deals by status, plus the next follow-ups.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'quote_catalog',
    description: 'USD quote from store/data/catalog.json only. Accepts catalog SKU or a hint like "500ml tumbler"/"保温杯"; never invent prices. Client draft only.',
    inputSchema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'Catalog SKU (HK-TB-500-SS) or product hint (500ml tumbler)' },
        qty: { type: 'number' },
        buyer: { type: 'string' },
      },
      required: ['sku', 'qty'],
    },
  },
  {
    name: 'record_reply',
    description: 'User said they sent outreach or the buyer replied. Updates touch to user-sent/replied, quotes the NAMED company at the given qty from catalog, writes team/deals/<id>.md. Do not quote other companies instead.',
    inputSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' },
        sku: { type: 'string' },
        qty: { type: 'number' },
        touch: { type: 'string', description: 'user-sent | replied' },
        market: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['company'],
    },
  },
  {
    name: 'draft_outreach',
    description: 'English cold-email draft for a lead. Not sent. Do not invent contact details.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        sku: { type: 'string' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'search_queries',
    description: 'Public-web search queries to find importers for a product+market. Run them with official web_search; this is not a customs database.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string' },
        market: { type: 'string' },
      },
    },
  },
  {
    name: 'export_leads_csv',
    description: 'Export the lead pool as CSV (id, company, market, group, source, touch).',
    inputSchema: { type: 'object', properties: {} },
  },
]

function asText(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

startStdioMcpServer({
  name: 'trade-crm',
  version: '1.0.0',
  tools: TOOLS,
  async call(name, args) {
    if (name === 'list_leads') return formatLeads(listLeads(args || {}))
    if (name === 'upsert_lead') {
      const row = upsertLead(args || {})
      return `upserted ${row.id} ${row.company} (${row.group}/${row.touch})\n${formatLeads([row])}`
    }
    if (name === 'list_deals') return formatDeals(listDeals(args || {}))
    if (name === 'upsert_deal') {
      const row = upsertDeal(args || {})
      return `upserted ${row.id} ${row.buyer} (${row.status})\n${formatDeals([row])}`
    }
    if (name === 'pipeline_summary') return asText(pipelineSummary())
    if (name === 'quote_catalog') {
      const quote = quoteCatalog(args || {})
      return quote.markdown
    }
    if (name === 'record_reply') {
      const out = recordReply(args || {})
      const quoteText = out.quote?.markdown || out.note || ''
      return [
        `lead ${out.lead.id} ${out.lead.company} touch=${out.lead.touch}`,
        out.deal ? `deal ${out.deal.id} ${out.deal.sku} x${out.deal.qty} ${out.deal.status} file=${out.deal.file}` : '',
        quoteText,
      ].filter(Boolean).join('\n')
    }
    if (name === 'draft_outreach') {
      const out = draftOutreach(args || {})
      return out.letter
    }
    if (name === 'search_queries') return asText(searchQueries(args || {}))
    if (name === 'export_leads_csv') return exportLeadsCsv()
    throw new Error(`Unknown tool: ${name}`)
  },
})
