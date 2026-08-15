import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addObservations,
  createEntities,
  createRelations,
  emptyGraph,
  formatGraph,
  searchNodes,
} from './memory-graph.mjs'

test('memory graph stores entities, relations, and substring search', () => {
  let graph = emptyGraph()
  graph = createEntities(graph, [{ name: 'IKEA', entityType: 'company', observations: ['Swedish retailer'] }])
  graph = createRelations(graph, [{ from: 'IKEA', to: 'Sweden', relationType: 'based_in' }])
  graph = addObservations(graph, [{ entityName: 'IKEA', contents: ['Housewares buyer'] }])
  const found = searchNodes(graph, 'housewares')
  assert.equal(found.entities[0].name, 'IKEA')
  assert.match(formatGraph(graph), /IKEA/)
  assert.match(formatGraph(graph), /based_in/)
})
