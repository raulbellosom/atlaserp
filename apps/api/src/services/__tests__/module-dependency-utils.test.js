import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectRequiredDependencyCycle,
  formatDependencyCycle,
  normalizeManifestDependencies,
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
