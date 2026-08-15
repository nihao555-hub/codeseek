#!/usr/bin/env node
/**
 * 本地知识图谱记忆 MCP。NDJSON，不走官方 SDK stdio。
 */
import {
  addObservations,
  createEntities,
  createRelations,
  defaultMemoryPath,
  formatGraph,
  loadGraph,
  saveGraph,
  searchNodes,
} from './lib/memory-graph.mjs'
import { startStdioMcpServer } from './lib/mcp-stdio.mjs'

const PATH = defaultMemoryPath()

function mutate(writer) {
  const next = writer(loadGraph(PATH))
  saveGraph(next, PATH)
  return formatGraph(next)
}

const TOOLS = [
  {
    name: 'create_entities',
    description: 'Create or update named entities in the local memory graph.',
    inputSchema: {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              entityType: { type: 'string' },
              observations: { type: 'array', items: { type: 'string' } },
            },
            required: ['name'],
          },
        },
      },
      required: ['entities'],
    },
  },
  {
    name: 'create_relations',
    description: 'Create relations between entities in the local memory graph.',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              relationType: { type: 'string' },
            },
            required: ['from', 'to', 'relationType'],
          },
        },
      },
      required: ['relations'],
    },
  },
  {
    name: 'add_observations',
    description: 'Append observations to an existing entity.',
    inputSchema: {
      type: 'object',
      properties: {
        observations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string' },
              contents: { type: 'array', items: { type: 'string' } },
            },
            required: ['entityName', 'contents'],
          },
        },
      },
      required: ['observations'],
    },
  },
  {
    name: 'search_nodes',
    description: 'Search entities and relations by substring.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'read_graph',
    description: 'Dump the whole local memory graph.',
    inputSchema: { type: 'object', properties: {} },
  },
]

startStdioMcpServer({
  name: 'memory',
  version: '1.0.0',
  tools: TOOLS,
  async call(name, args) {
    if (name === 'create_entities') return mutate((graph) => createEntities(graph, args.entities))
    if (name === 'create_relations') return mutate((graph) => createRelations(graph, args.relations))
    if (name === 'add_observations') return mutate((graph) => addObservations(graph, args.observations))
    if (name === 'search_nodes') return formatGraph(searchNodes(loadGraph(PATH), args.query))
    if (name === 'read_graph') return formatGraph(loadGraph(PATH))
    throw new Error(`Unknown tool: ${name}`)
  },
})
