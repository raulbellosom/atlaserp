import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateModulePwaIdentity } from '@atlas/module-engine'
import { coreModules, inventoryMap } from '../core-modules.js'
import { projectsMap } from '../feature-modules.js'

test('all official modules declare a valid PWA identity', () => {
  for (const moduleManifest of coreModules) {
    const result = validateModulePwaIdentity(moduleManifest)
    assert.equal(
      result.valid,
      true,
      `${moduleManifest.key}: ${result.errors.join('; ')}`,
    )
  }
})

test('inventory and projects use distinct install identities', () => {
  assert.equal(inventoryMap.icon, 'Boxes')
  assert.notEqual(inventoryMap.icon, projectsMap.icon)
  assert.notEqual(inventoryMap.pwa.startPath, projectsMap.pwa.startPath)
})
