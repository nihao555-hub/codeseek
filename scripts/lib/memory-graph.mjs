/**
 * 本地知识图谱记忆。文件默认 $DSH_HOME/memory-graph.json。
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

export function defaultMemoryPath() {
  const home = process.env.DSH_HOME || '/workspace/dsh-home'
  return `${home.replace(/\/$/, '')}/memory-graph.json`
}

export function emptyGraph() {
  return { entities: [], relations: [] }
}

export function loadGraph(path = defaultMemoryPath()) {
  if (!existsSync(path)) return emptyGraph()
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    return {
      entities: Array.isArray(data.entities) ? data.entities : [],
      relations: Array.isArray(data.relations) ? data.relations : [],
    }
  } catch {
    return emptyGraph()
  }
}

export function saveGraph(graph, path = defaultMemoryPath()) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(graph, null, 2)}\n`)
  return graph
}

function clip(text, n = 240) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, n)
}

export function createEntities(graph, entities) {
  const next = structuredClone(graph)
  for (const item of entities || []) {
    const name = String(item.name || '').trim()
    if (!name) continue
    let row = next.entities.find((entity) => entity.name === name)
    if (!row) {
      row = { name, entityType: String(item.entityType || 'thing'), observations: [] }
      next.entities.push(row)
    }
    for (const observation of item.observations || []) {
      const text = clip(observation, 500)
      if (text && !row.observations.includes(text)) row.observations.push(text)
    }
  }
  return next
}

export function createRelations(graph, relations) {
  const next = structuredClone(graph)
  for (const item of relations || []) {
    const from = String(item.from || '').trim()
    const to = String(item.to || '').trim()
    const relationType = String(item.relationType || '').trim()
    if (!from || !to || !relationType) continue
    const exists = next.relations.some((row) => row.from === from && row.to === to && row.relationType === relationType)
    if (!exists) next.relations.push({ from, to, relationType })
  }
  return next
}

export function addObservations(graph, observations) {
  const next = structuredClone(graph)
  for (const item of observations || []) {
    const name = String(item.entityName || item.name || '').trim()
    const row = next.entities.find((entity) => entity.name === name)
    if (!row) continue
    for (const observation of item.contents || item.observations || []) {
      const text = clip(observation, 500)
      if (text && !row.observations.includes(text)) row.observations.push(text)
    }
  }
  return next
}

export function searchNodes(graph, query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return { entities: graph.entities, relations: graph.relations }
  const entities = graph.entities.filter((entity) => {
    const hay = [entity.name, entity.entityType, ...(entity.observations || [])].join('\n').toLowerCase()
    return hay.includes(needle)
  })
  const names = new Set(entities.map((entity) => entity.name))
  const relations = graph.relations.filter((row) => names.has(row.from) || names.has(row.to))
  return { entities, relations }
}

export function formatGraph(graph) {
  if (!graph.entities.length && !graph.relations.length) return 'Memory graph is empty.'
  const lines = ['# Entities']
  for (const entity of graph.entities) {
    lines.push(`- ${entity.name} (${entity.entityType})`)
    for (const observation of entity.observations || []) lines.push(`  - ${observation}`)
  }
  if (graph.relations.length) {
    lines.push('# Relations')
    for (const row of graph.relations) lines.push(`- ${row.from} --${row.relationType}--> ${row.to}`)
  }
  return lines.join('\n')
}
