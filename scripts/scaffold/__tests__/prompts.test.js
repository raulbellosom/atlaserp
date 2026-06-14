import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectInteractiveConfig } from '../prompts.js'

test('interactive scaffolder collects complete PWA identity', async () => {
  const answers = [
    'custom.inventory',
    'Inventario',
    '',
    'Activos',
    'Boxes',
    '#7c3aed',
    '',
    '/inventory',
    'item',
    'Item',
    '',
    '',
    '',
    'name',
    'text',
    'Nombre',
    'n',
    '',
    'n',
    'n',
  ]
  const config = await collectInteractiveConfig({
    ask: async () => answers.shift(),
    log() {},
  })

  assert.equal(config.icon, 'Boxes')
  assert.equal(config.color, '#7c3aed')
  assert.deepEqual(config.pwa, {
    shortName: 'Inventario',
    startPath: '/inventory',
  })
})
