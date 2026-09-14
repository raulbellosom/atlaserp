import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectRequiredDependencyCycle,
  formatDependencyCycle,
  normalizeManifestDependencies,
  loadManifestDependencies,
} from '../module-dependency-utils.js'

test('normalizeManifestDependencies merges duplicates and preserves required precedence', () => {
  const result = normalizeManifestDependencies([
    { key: 'atlas.core', optional: true },
    { key: 'atlas.core', optional: false },
    { key: 'atlas.files', optional: true, versionRange: '^1.0.0' },
  ])

  assert.deepEqual(result, [
    { key: 'atlas.core', optional: false, versionRange: null },
    { key: 'atlas.files', optional: true, versionRange: '^1.0.0' },
  ])
})

test('detectRequiredDependencyCycle returns null when graph is acyclic', () => {
  const cycle = detectRequiredDependencyCycle({
    moduleId: 'a',
    requiredDependencyIds: ['b'],
    existingRequiredEdges: [
      { moduleId: 'b', dependencyId: 'c' },
    ],
  })

  assert.equal(cycle, null)
})

test('detectRequiredDependencyCycle returns path when cycle is introduced', () => {
  const cycle = detectRequiredDependencyCycle({
    moduleId: 'a',
    requiredDependencyIds: ['b'],
    existingRequiredEdges: [
      { moduleId: 'b', dependencyId: 'a' },
    ],
  })

  assert.deepEqual(cycle, ['a', 'b', 'a'])
})

test('formatDependencyCycle renders readable key path', () => {
  const idToKey = new Map([
    ['a', 'custom.alpha'],
    ['b', 'custom.beta'],
  ])
  const output = formatDependencyCycle({ cycle: ['a', 'b', 'a'], idToKey })

  assert.equal(output, 'custom.alpha -> custom.beta -> custom.alpha')
})

function dependencyDatabase(rows) {
  const queries = []
  return { queries, atlasModule: { findMany: async query => {
    queries.push(query)
    return rows.filter(row => query.where.key.in.includes(row.key))
  } } }
}

test('dependency lookup resolves both official spellings to the persisted UUID in one query', async () => {
  for (const [declared, stored] of [['atlas.core', 'runly.core'], ['runly.core', 'atlas.core']]) {
    const db = dependencyDatabase([{ id: 'existing-uuid', key: stored }])
    const result = await loadManifestDependencies(db, [{ key: declared, versionRange: '^1.0.0' }])
    assert.deepEqual(result.resolved, [{ key: stored, dependencyId: 'existing-uuid', optional: false, versionRange: '^1.0.0' }])
    assert.deepEqual(result.missingRequired, [])
    assert.equal(db.queries.length, 1)
    assert.deepEqual(new Set(db.queries[0].where.key.in), new Set(['atlas.core', 'runly.core']))
  }
})

test('two spellings of one UUID merge required precedence without duplicate edges', async () => {
  const db = dependencyDatabase([{ id: 'core-id', key: 'runly.core' }])
  const result = await loadManifestDependencies(db, [{ key: 'atlas.core', optional: false }, { key: 'runly.core', optional: true, versionRange: '^1.0.0' }])
  assert.equal(result.declared, 2)
  assert.deepEqual(result.resolved, [{ key: 'runly.core', dependencyId: 'core-id', optional: false, versionRange: '^1.0.0' }])
})

test('exact persisted collisions remain distinct dependency edges', async () => {
  const db = dependencyDatabase([{ id: 'legacy-id', key: 'atlas.core' }, { id: 'current-id', key: 'runly.core' }])
  const result = await loadManifestDependencies(db, ['atlas.core', 'runly.core'])
  assert.deepEqual(result.resolved.map(dep => dep.dependencyId), ['legacy-id', 'current-id'])
})

test('incompatible alias version declarations fail explicitly', async () => {
  const db = dependencyDatabase([{ id: 'core-id', key: 'runly.core' }])
  await assert.rejects(loadManifestDependencies(db, [
    { key: 'atlas.core', versionRange: '^1.0.0' }, { key: 'runly.core', versionRange: '^2.0.0' },
  ]), { code: 'DEPENDENCY_ALIAS_VERSION_CONFLICT', status: 409 })
})

test('unknown namespaces never alias and missing required/optional declarations stay separate', async () => {
  const db = dependencyDatabase([{ id: 'unknown', key: 'runly.unknown' }])
  const result = await loadManifestDependencies(db, ['atlas.unknown', { key: 'custom.missing', optional: true }])
  assert.deepEqual(result.missingRequired, ['atlas.unknown'])
  assert.deepEqual(result.missingOptional, ['custom.missing'])
  assert.deepEqual(result.resolved, [])
  assert.ok(!db.queries[0].where.key.in.includes('runly.unknown'))
})

test('empty dependencies avoid queries and alias self-dependencies are detected by UUID', async () => {
  const db = dependencyDatabase([{ id: 'self-id', key: 'runly.core' }])
  assert.equal((await loadManifestDependencies(db, [])).declared, 0)
  assert.equal(db.queries.length, 0)
  const result = await loadManifestDependencies(db, ['atlas.core'])
  assert.deepEqual(detectRequiredDependencyCycle({ moduleId: 'self-id', requiredDependencyIds: result.resolved.map(dep => dep.dependencyId) }), ['self-id', 'self-id'])
})
